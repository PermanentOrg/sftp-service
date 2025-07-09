import path from "path";
import fs from "fs";
import {
	createFolder,
	createArchiveRecord,
	deleteArchiveRecord,
	deleteFolder,
	getArchives,
	getArchiveFolders,
	getFolder,
	getAuthenticatedAccount,
	uploadFile,
	HttpResponseError,
} from "@permanentorg/sdk";
import {
	FileSystemObjectNotFound,
	InvalidOperationForPathError,
	PermissionDeniedError,
} from "../errors";
import {
	deduplicateFileEntries,
	generateAttributesForArchive,
	generateAttributesForFile,
	generateAttributesForFolder,
	generateDefaultAttributes,
	generateFileEntry,
	generateFileEntriesForArchiveRecords,
	generateFileEntriesForFolders,
	getArchiveSlugFromPath,
	getOriginalFileForArchiveRecord,
} from "../utils";
import type { Readable } from "stream";
import type {
	Archive,
	ClientConfiguration,
	Folder,
	File,
	ArchiveRecord,
} from "@permanentorg/sdk";
import type { Attributes, FileEntry } from "ssh2";
import type { AuthTokenManager } from "./AuthTokenManager";

const isRootPath = (fileSystemPath: string): boolean => fileSystemPath === "/";

const isArchiveCataloguePath = (fileSystemPath: string): boolean =>
	fileSystemPath === "/archives";

// e.g. '/archives/Foo (1)'
const isArchivePath = (fileSystemPath: string): boolean =>
	fileSystemPath.startsWith("/archives") &&
	fileSystemPath.split("/").length === 3;

// e.g. '/archives/Foo (1)/My Files'
const isArchiveChildFolderPath = (fileSystemPath: string): boolean =>
	fileSystemPath.startsWith("/archives") &&
	fileSystemPath.split("/").length === 4;

// e.g. '/archives/Foo (1)/**'
const isItemPath = (fileSystemPath: string): boolean =>
	fileSystemPath.startsWith("/archives") &&
	fileSystemPath.split("/").length > 3;

const isPermanentFileSystemPath = (fileSystemPath: string): boolean =>
	isRootPath(fileSystemPath) ||
	isArchiveCataloguePath(fileSystemPath) ||
	isArchivePath(fileSystemPath) ||
	isItemPath(fileSystemPath);

export class PermanentFileSystem {
	private readonly folderCache = new Map<string, Folder>();

	private readonly archiveFoldersCache = new Map<number, Folder[]>();

	private readonly archiveRecordCache = new Map<string, ArchiveRecord>();

	private archivesCache?: Archive[];

	private readonly authTokenManager;

	public constructor(authTokenManager: AuthTokenManager) {
		this.authTokenManager = authTokenManager;
	}

	private static loadRootFileEntries(): FileEntry[] {
		return [
			generateFileEntry(
				"archives",
				generateDefaultAttributes(fs.constants.S_IFDIR),
			),
		];
	}

	public async getFileSystemObjectType(
		fileSystemPath: string,
		overrideParentCache = false,
	): Promise<number> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (isRootPath(fileSystemPath) || isArchiveCataloguePath(fileSystemPath)) {
			return fs.constants.S_IFDIR;
		}

		if (isArchivePath(fileSystemPath)) {
			await this.assertArchiveExistsByPath(fileSystemPath);
			return fs.constants.S_IFDIR;
		}

		// Generally an archive child folder is an `item`, but since its parent
		// is an archive we need to treat it a little bit differently.
		//
		// We also don't need to check its type (just its existence) since the root
		// level of an archive is only allowed to hold folders.
		if (isArchiveChildFolderPath(fileSystemPath)) {
			await this.assertArchiveChildFolderExistsByPath(fileSystemPath);
			return fs.constants.S_IFDIR;
		}

		const parentPath = path.dirname(fileSystemPath);
		const childName = path.basename(fileSystemPath);
		const parentFolder = await this.loadFolder(parentPath, overrideParentCache);
		const targetIsFile = parentFolder.archiveRecords.some(
			(archiveRecord) => archiveRecord.fileSystemCompatibleName === childName,
		);
		if (targetIsFile) {
			return fs.constants.S_IFREG;
		}
		const targetIsFolder = parentFolder.folders.some(
			(folder) => folder.fileSystemCompatibleName === childName,
		);
		if (targetIsFolder) {
			return fs.constants.S_IFDIR;
		}
		if (!overrideParentCache) {
			return this.getFileSystemObjectType(fileSystemPath, true);
		}
		throw new FileSystemObjectNotFound(
			`A file system object at the specified path could not be found: ${fileSystemPath}`,
		);
	}

	public async getFileSystemObjectAttributes(
		fileSystemPath: string,
	): Promise<Attributes> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (isRootPath(fileSystemPath) || isArchiveCataloguePath(fileSystemPath)) {
			return generateDefaultAttributes(fs.constants.S_IFDIR);
		}

		if (isArchivePath(fileSystemPath)) {
			const archive = await this.loadArchive(fileSystemPath);
			return generateAttributesForArchive(archive);
		}

		const fileType = await this.getFileSystemObjectType(fileSystemPath);
		switch (fileType) {
			case fs.constants.S_IFREG: {
				const file = await this.loadFile(fileSystemPath);
				return generateAttributesForFile(file);
			}
			case fs.constants.S_IFDIR: {
				const folder = await this.loadFolder(fileSystemPath);
				return generateAttributesForFolder(folder);
			}
			default:
				// Since fileType is not an enum we need a default case
				throw new FileSystemObjectNotFound(
					`The specified path is neither a file nor a directory: ${fileSystemPath}`,
				);
		}
	}

	public async loadDirectory(fileSystemPath: string): Promise<FileEntry[]> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (isRootPath(fileSystemPath)) {
			return PermanentFileSystem.loadRootFileEntries();
		}
		if (isArchiveCataloguePath(fileSystemPath)) {
			return this.loadArchiveFileEntries();
		}
		if (isArchivePath(fileSystemPath)) {
			return this.loadArchiveFoldersFileEntries(fileSystemPath);
		}
		if (isItemPath(fileSystemPath)) {
			return this.loadFolderFileEntries(fileSystemPath);
		}
		return [];
	}

	public async createDirectory(fileSystemPath: string): Promise<void> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new PermissionDeniedError(
				`The specified path cannot exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (isRootPath(fileSystemPath)) {
			throw new PermissionDeniedError("You cannot create the root folder.");
		}
		if (isArchiveCataloguePath(fileSystemPath)) {
			throw new PermissionDeniedError(
				"You cannot create the archive catalogue.",
			);
		}
		if (isArchivePath(fileSystemPath)) {
			throw new PermissionDeniedError("You cannot create archives via SFTP.");
		}
		if (isArchiveChildFolderPath(fileSystemPath)) {
			throw new PermissionDeniedError(
				"You cannot create folders at the root level of an archive.",
			);
		}
		const parentPath = path.dirname(fileSystemPath);
		const childName = path.basename(fileSystemPath);
		const parentFolder = await this.loadFolder(parentPath);
		const newFolder = await createFolder(await this.getClientConfiguration(), {
			folder: {
				name: childName,
			},
			parentFolder,
			failOnDuplicateName: true,
		});
		parentFolder.folders.push(newFolder);
		await this.updateFolderInCache(parentPath, parentFolder);
		await this.updateFolderInCache(fileSystemPath, newFolder);
	}

	public async deleteDirectory(fileSystemPath: string): Promise<void> {
		// This is not wrapped in a try / catch block because if this endpoint fails it
		// represents some kind of system failure / users should be able to
		// access this endpoint so long as they are authenticated.
		const account = await getAuthenticatedAccount(
			await this.getClientConfiguration(),
		);
		if (!account.isSftpDeletionEnabled) {
			throw new PermissionDeniedError(
				"You must enable SFTP deletion directly in your account settings.",
			);
		}
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (isRootPath(fileSystemPath)) {
			throw new PermissionDeniedError("You cannot delete the root folder.");
		}
		if (isArchiveCataloguePath(fileSystemPath)) {
			throw new PermissionDeniedError(
				"You cannot delete the archive catalogue.",
			);
		}
		if (isArchivePath(fileSystemPath)) {
			throw new PermissionDeniedError("You cannot delete archives via SFTP.");
		}
		if (isArchiveChildFolderPath(fileSystemPath)) {
			throw new PermissionDeniedError(
				"You cannot delete folders at the root level of an archive.",
			);
		}

		const folder = await this.loadFolder(fileSystemPath);

		try {
			await deleteFolder(await this.getClientConfiguration(), {
				folderId: folder.id,
			});
		} catch (error) {
			if (error instanceof HttpResponseError && error.statusCode === 404) {
				throw new FileSystemObjectNotFound(
					`The specified folder does not exist: ${fileSystemPath}`,
				);
			}
			if (error instanceof HttpResponseError && error.statusCode === 401) {
				throw new PermissionDeniedError(
					`You do not have permission to delete this folder: ${fileSystemPath}`,
				);
			}
			throw error;
		}
	}

	public async createFile(
		fileSystemPath: string,
		dataStream: Readable,
		size: number,
	): Promise<void> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new PermissionDeniedError(
				`The specified path cannot exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		const parentPath = path.dirname(fileSystemPath);
		const archiveRecordName = path.basename(fileSystemPath);
		const parentFolder = await this.loadFolder(parentPath);
		const fileFragment = {
			contentType: "application/octet-stream",
			size,
		};
		const archiveRecordFragment = {
			displayName: archiveRecordName,
			fileSystemCompatibleName: archiveRecordName,
		};

		// These calls are SDK operations that are not in a try / catch block because
		// if something goes wrong at this point it really is a `FAILURE`.
		//
		// We may want to get more specific error types (e.g. "not enough space") which
		// could be translated to more specific sftp response messages, but even in those
		// cases the SFTP response would be a `FAILURE`.
		const s3Url = await uploadFile(await this.getClientConfiguration(), {
			fileData: dataStream,
			file: fileFragment,
			item: archiveRecordFragment,
			parentFolder,
		});
		const newArchiveRecord = await createArchiveRecord(
			await this.getClientConfiguration(),
			{
				s3Url,
				file: fileFragment,
				item: archiveRecordFragment,
				parentFolder,
				failOnDuplicateName: true,
			},
		);
		parentFolder.archiveRecords.push(newArchiveRecord);
		this.archiveRecordCache.set(fileSystemPath, newArchiveRecord);
		await this.updateFolderInCache(parentPath, parentFolder);
	}

	public async deleteFile(fileSystemPath: string): Promise<void> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		const account = await getAuthenticatedAccount(
			await this.getClientConfiguration(),
		);
		if (!account.isSftpDeletionEnabled) {
			throw new PermissionDeniedError(
				"You must enable SFTP deletion directly in your account settings.",
			);
		}

		if (!isItemPath(fileSystemPath)) {
			throw new InvalidOperationForPathError("Invalid file path");
		}

		const archiveRecord = await this.loadArchiveRecord(fileSystemPath);

		await deleteArchiveRecord(await this.getClientConfiguration(), {
			archiveRecordId: archiveRecord.id,
		});
	}

	public async loadFile(
		fileSystemPath: string,
		overrideCache = false,
	): Promise<File> {
		if (!isPermanentFileSystemPath(fileSystemPath)) {
			throw new FileSystemObjectNotFound(
				`The specified path does not exist in the Permanent file system: ${fileSystemPath}`,
			);
		}
		if (!isItemPath(fileSystemPath)) {
			throw new InvalidOperationForPathError("Invalid file path");
		}
		const archiveRecord = await this.loadArchiveRecord(
			fileSystemPath,
			overrideCache,
		);
		return getOriginalFileForArchiveRecord(archiveRecord);
	}

	private async updateFolderInCache(
		folderPath: string,
		folder: Folder,
	): Promise<void> {
		if (isArchiveChildFolderPath(folderPath)) {
			const archiveId = await this.loadArchiveIdFromPath(folderPath);
			const archiveFolders = await this.loadArchiveFolders(archiveId);
			const targetIndex = archiveFolders.findIndex(
				(candidateFolder) => candidateFolder.name === folder.name,
			);
			archiveFolders[targetIndex] = folder;
			this.archiveFoldersCache.set(archiveId, archiveFolders);
		} else {
			this.folderCache.set(folderPath, folder);
		}
	}

	public folderPathExistsInCache(fileSystemPath: string): boolean {
		if (this.folderCache.has(fileSystemPath)) {
			return true;
		}
		const parentPath = path.dirname(fileSystemPath);
		const folderName = path.basename(fileSystemPath);
		const parentFolder = this.folderCache.get(parentPath);
		if (!parentFolder) {
			return false;
		}
		const foundFolder = parentFolder.folders.find(
			(folder) => folder.fileSystemCompatibleName === folderName,
		);
		return foundFolder !== undefined;
	}

	public archiveRecordPathExistsInCache(fileSystemPath: string): boolean {
		if (this.archiveRecordCache.has(fileSystemPath)) {
			return true;
		}
		const parentPath = path.dirname(fileSystemPath);
		const archiveRecordName = path.basename(fileSystemPath);
		const parentFolder = this.folderCache.get(parentPath);
		if (!parentFolder) {
			return false;
		}
		const foundArchiveRecord = parentFolder.archiveRecords.find(
			(folder) => folder.fileSystemCompatibleName === archiveRecordName,
		);
		return foundArchiveRecord !== undefined;
	}

	private async assertArchiveExistsByPath(
		fileSystemPath: string,
	): Promise<void> {
		if (!isArchivePath(fileSystemPath)) {
			throw new InvalidOperationForPathError(
				`The requested path is not an archive path: ${fileSystemPath}`,
			);
		}
		try {
			await this.loadArchive(fileSystemPath);
		} catch (error) {
			if (error instanceof FileSystemObjectNotFound) {
				throw new FileSystemObjectNotFound(
					`A resource at the specified path could not be found: ${fileSystemPath}`,
				);
			}
			throw error;
		}
	}

	private async assertArchiveChildFolderExistsByPath(
		fileSystemPath: string,
	): Promise<void> {
		if (!isArchiveChildFolderPath(fileSystemPath)) {
			throw new InvalidOperationForPathError(
				"The requested path is not an archive child folder path",
			);
		}

		try {
			await this.loadFolder(fileSystemPath);
		} catch (error) {
			if (error instanceof FileSystemObjectNotFound) {
				throw new FileSystemObjectNotFound(
					`A resource at the specified path could not be found ${fileSystemPath}`,
				);
			}
			throw error;
		}
	}

	private async loadArchiveRecord(
		fileSystemPath: string,
		overrideCache = false,
	): Promise<ArchiveRecord> {
		const cachedArchiveRecord = this.archiveRecordCache.get(fileSystemPath);
		if (cachedArchiveRecord && !overrideCache) {
			return cachedArchiveRecord;
		}
		const parentPath = path.dirname(fileSystemPath);
		const childName = path.basename(fileSystemPath);
		const populatedArchiveRecord =
			await this.findArchiveRecordInParentDirectory(parentPath, childName);
		this.archiveRecordCache.set(fileSystemPath, populatedArchiveRecord);
		return populatedArchiveRecord;
	}

	private async getClientConfiguration(): Promise<ClientConfiguration> {
		const authToken = await this.authTokenManager.getAuthToken();
		return {
			bearerToken: authToken,
			baseUrl: process.env.PERMANENT_API_BASE_PATH,
			stelaBaseUrl: process.env.STELA_API_BASE_PATH,
			retryOn: [429, 500, 502, 503, 504],
			retries: 5, // given our delay function, the total retry window with 5 retries is ~15 minutes
			retryDelay: (attempt: number) => 2 ** attempt * 15000,
		};
	}

	private async loadArchives(): Promise<Archive[]> {
		if (!this.archivesCache) {
			// This is not in a try / catch block because if this endpoint fails it
			// represents some kind of system failure / users should be able to
			// access this endpoint so long as they are authenticated.
			this.archivesCache = await getArchives(
				await this.getClientConfiguration(),
			);
		}
		return this.archivesCache;
	}

	private async loadArchiveByArchiveSlug(slug: string): Promise<Archive> {
		const archives = await this.loadArchives();
		const archive = archives.find((candidate) => candidate.slug === slug);
		if (archive === undefined) {
			throw new FileSystemObjectNotFound(
				"An archive with that slug could not be found",
			);
		}
		return archive;
	}

	private async loadArchiveIdFromPath(fileSystemPath: string): Promise<number> {
		const archiveSlug = getArchiveSlugFromPath(fileSystemPath);
		const archive = await this.loadArchiveByArchiveSlug(archiveSlug);
		return archive.id;
	}

	private async loadArchiveFolders(archiveId: number): Promise<Folder[]> {
		const cachedArchiveFolders = this.archiveFoldersCache.get(archiveId);
		if (cachedArchiveFolders) {
			return cachedArchiveFolders;
		}
		try {
			const archiveFolders = await getArchiveFolders(
				await this.getClientConfiguration(),
				{
					archiveId,
				},
			);
			this.archiveFoldersCache.set(archiveId, archiveFolders);
			return archiveFolders;
		} catch (error) {
			if (error instanceof HttpResponseError && error.statusCode === 404) {
				throw new FileSystemObjectNotFound(
					"The specified archive does not exist",
				);
			}
			if (error instanceof HttpResponseError && error.statusCode === 401) {
				throw new PermissionDeniedError(
					"You do not have permission to access this archive",
				);
			}
			throw error;
		}
	}

	private async loadArchive(fileSystemPath: string): Promise<Archive> {
		if (!isArchivePath(fileSystemPath)) {
			throw new InvalidOperationForPathError(
				"The requested path is not an archive",
			);
		}
		const archiveSlug = getArchiveSlugFromPath(fileSystemPath);
		return this.loadArchiveByArchiveSlug(archiveSlug);
	}

	private async findFolderInParentDirectory(
		parentPath: string,
		folderName: string,
		overrideParentCache = false,
	): Promise<Folder> {
		const archiveId = await this.loadArchiveIdFromPath(parentPath);
		const childFolders = isArchivePath(parentPath)
			? await this.loadArchiveFolders(archiveId)
			: (await this.loadFolder(parentPath, overrideParentCache)).folders;
		const targetFolder = childFolders.find(
			(folder) => folder.fileSystemCompatibleName === folderName,
		);

		if (overrideParentCache && !targetFolder) {
			throw new FileSystemObjectNotFound(
				`The specified folder does not exist (${parentPath}/${folderName})`,
			);
		}
		return (
			targetFolder ??
			this.findFolderInParentDirectory(parentPath, folderName, true)
		);
	}

	private async findArchiveRecordInParentDirectory(
		parentPath: string,
		archiveRecordName: string,
		overrideParentCache = false,
	): Promise<ArchiveRecord> {
		const parentFolder = await this.loadFolder(parentPath, overrideParentCache);
		const targetArchiveRecord = parentFolder.archiveRecords.find(
			(folder) => folder.fileSystemCompatibleName === archiveRecordName,
		);

		if (targetArchiveRecord) {
			return targetArchiveRecord;
		}
		if (overrideParentCache) {
			throw new FileSystemObjectNotFound(
				"The specified archive record does not exist",
			);
		}
		// At this point we know that the lookup failed but ALSO that we may have been using a cached
		// version of the parent directory when checking for the child (`overrideParentCache` is false).
		// It's possible the archiveRecord does actually exist; we just need to force a load of
		// the parent, which is what this recursive call demands (by setting the override to true).
		return this.findArchiveRecordInParentDirectory(
			parentPath,
			archiveRecordName,
			true,
		);
	}

	private async loadFolder(
		fileSystemPath: string,
		overrideCache = false,
	): Promise<Folder> {
		const cachedFolder = this.folderCache.get(fileSystemPath);
		if (cachedFolder && !overrideCache) {
			return cachedFolder;
		}

		if (!isItemPath(fileSystemPath)) {
			throw new InvalidOperationForPathError(
				"The requested path is not a folder",
			);
		}

		const parentPath = path.dirname(fileSystemPath);
		const childName = path.basename(fileSystemPath);
		const targetFolder = await this.findFolderInParentDirectory(
			parentPath,
			childName,
		);

		try {
			const populatedTargetFolder = await getFolder(
				await this.getClientConfiguration(),
				{
					folderId: targetFolder.id,
				},
			);
			this.folderCache.set(fileSystemPath, populatedTargetFolder);
			return populatedTargetFolder;
		} catch (error) {
			// This is a temporary workaround for the fact that the SDK does not return an
			// appropriate error when a folder is not found / there is no 404 response
			// since Stela does not support individual item lookups.
			// See https://github.com/PermanentOrg/permanent-sdk/issues/518
			if (error instanceof Error && error.message === "Folder not found") {
				throw new FileSystemObjectNotFound(
					`The specified folder does not exist: ${fileSystemPath}`,
				);
			}
			if (error instanceof HttpResponseError && error.statusCode === 404) {
				throw new FileSystemObjectNotFound(
					`The specified folder does not exist: ${fileSystemPath}`,
				);
			}
			if (error instanceof HttpResponseError && error.statusCode === 401) {
				throw new PermissionDeniedError(
					`You do not have permission to access this folder: ${fileSystemPath}`,
				);
			}
			throw error;
		}
	}

	private async loadArchiveFileEntries(): Promise<FileEntry[]> {
		const archives = await this.loadArchives();
		return archives.map((archive: Archive) =>
			generateFileEntry(
				`${archive.name} (${archive.slug})`,
				generateAttributesForArchive(archive),
			),
		);
	}

	private async loadArchiveFoldersFileEntries(
		archivePath: string,
	): Promise<FileEntry[]> {
		const archiveId = await this.loadArchiveIdFromPath(archivePath);
		const folders = await this.loadArchiveFolders(archiveId);
		return folders.map((archiveFolder) =>
			generateFileEntry(
				archiveFolder.fileSystemCompatibleName,
				generateAttributesForFolder(archiveFolder),
			),
		);
	}

	private async loadFolderFileEntries(
		fileSystemPath: string,
		overrideCache = false,
	): Promise<FileEntry[]> {
		const childFolder = await this.loadFolder(fileSystemPath, overrideCache);
		const folderFileEntities = generateFileEntriesForFolders(
			childFolder.folders,
		);
		const archiveRecordFileEntities = generateFileEntriesForArchiveRecords(
			childFolder.archiveRecords,
		);
		return deduplicateFileEntries([
			...folderFileEntities,
			...archiveRecordFileEntities,
		]);
	}
}
