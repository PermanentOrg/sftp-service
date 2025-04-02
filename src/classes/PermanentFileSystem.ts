import path from 'path';
import fs from 'fs';
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
} from '@permanentorg/sdk';
import {
  InvalidOperationForPathError,
  NotFoundError,
  OperationNotAllowedError,
  ResourceDoesNotExistError,
} from '../errors';
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
} from '../utils';
import type { Readable } from 'stream';
import type {
  Archive,
  ClientConfiguration,
  Folder,
  File,
  ArchiveRecord,
} from '@permanentorg/sdk';
import type {
  Attributes,
  FileEntry,
} from 'ssh2';
import type { AuthTokenManager } from './AuthTokenManager';

const isRootPath = (requestedPath: string): boolean => (
  requestedPath === '/'
);

const isArchiveCataloguePath = (requestedPath: string): boolean => (
  requestedPath === '/archives'
);

// e.g. '/archives/Foo (1)'
const isArchivePath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length === 3
);

// e.g. '/archives/Foo (1)/My Files'
const isArchiveChildFolderPath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length === 4
);

// e.g. '/archives/Foo (1)/**'
const isItemPath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length > 3
);

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
        'archives',
        generateDefaultAttributes(fs.constants.S_IFDIR),
      ),
    ];
  }

  public async getItemType(
    itemPath: string,
    overrideParentCache = false,
  ): Promise<number> {
    if (isRootPath(itemPath)
     || isArchiveCataloguePath(itemPath)
     || isArchivePath(itemPath)
     || isArchiveChildFolderPath(itemPath)
    ) {
      return fs.constants.S_IFDIR;
    }
    const parentPath = path.dirname(itemPath);
    const childName = path.basename(itemPath);
    const parentFolder = await this.loadFolder(
      parentPath,
      overrideParentCache,
    );
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
      return this.getItemType(
        itemPath,
        true,
      );
    }
    throw new NotFoundError(`This path does not exist ${itemPath}`);
  }

  public async getItemAttributes(itemPath: string): Promise<Attributes> {
    if (isRootPath(itemPath)
     || isArchiveCataloguePath(itemPath)) {
      return generateDefaultAttributes(fs.constants.S_IFDIR);
    }

    if (isArchivePath(itemPath)) {
      const archive = await this.loadArchive(itemPath);
      return generateAttributesForArchive(archive);
    }

    const fileType = await this.getItemType(itemPath);
    switch (fileType) {
      case fs.constants.S_IFREG: {
        const file = await this.loadFile(itemPath);
        return generateAttributesForFile(file);
      }
      case fs.constants.S_IFDIR: {
        const folder = await this.loadFolder(itemPath);
        return generateAttributesForFolder(folder);
      }
      default:
        throw new NotFoundError('The specified path is neither a file nor a directory.');
    }
  }

  public async loadDirectory(requestedPath: string): Promise<FileEntry[]> {
    if (isRootPath(requestedPath)) {
      return PermanentFileSystem.loadRootFileEntries();
    }
    if (isArchiveCataloguePath(requestedPath)) {
      return this.loadArchiveFileEntries();
    }
    if (isArchivePath(requestedPath)) {
      return this.loadArchiveFoldersFileEntries(requestedPath);
    }
    if (isItemPath(requestedPath)) {
      return this.loadFolderFileEntries(requestedPath);
    }
    return [];
  }

  public async createDirectory(requestedPath: string): Promise<void> {
    if (isRootPath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot create new root level folders via SFTP.');
    }
    if (isArchiveCataloguePath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot create new archives via SFTP.');
    }
    if (isArchivePath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot create new folders at the root level of an archive via SFTP.');
    }
    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const parentFolder = await this.loadFolder(parentPath);
    const newFolder = await createFolder(
      await this.getClientConfiguration(),
      {
        folder: {
          name: childName,
        },
        parentFolder,
        failOnDuplicateName: true,
      },
    );
    parentFolder.folders.push(newFolder);
    await this.updateFolderInCache(parentPath, parentFolder);
    await this.updateFolderInCache(requestedPath, newFolder);
  }

  public async deleteDirectory(requestedPath: string): Promise<void> {
    const account = await getAuthenticatedAccount(
      await this.getClientConfiguration(),
    );
    if (!account.isSftpDeletionEnabled) {
      throw new OperationNotAllowedError('You must enable SFTP deletion directly in your account settings.');
    }

    if (isRootPath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot delete the root level folder.');
    }
    if (isArchiveCataloguePath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot delete the archive catalogue.');
    }
    if (isArchivePath(requestedPath)) {
      throw new InvalidOperationForPathError('You cannot delete archives via SFTP.');
    }

    const folder = await this.loadFolder(requestedPath);

    await deleteFolder(
      await this.getClientConfiguration(),
      {
        folderId: folder.id,
      },
    );
  }

  public async createFile(
    requestedPath: string,
    dataStream: Readable,
    size: number,
  ): Promise<void> {
    const parentPath = path.dirname(requestedPath);
    const archiveRecordName = path.basename(requestedPath);
    const parentFolder = await this.loadFolder(parentPath);
    const fileFragment = {
      contentType: 'application/octet-stream',
      size,
    };
    const archiveRecordFragment = {
      displayName: archiveRecordName,
      fileSystemCompatibleName: archiveRecordName,
    };
    const s3Url = await uploadFile(
      await this.getClientConfiguration(),
      {
        fileData: dataStream,
        file: fileFragment,
        item: archiveRecordFragment,
        parentFolder,
      },
    );
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
    this.archiveRecordCache.set(requestedPath, newArchiveRecord);
    await this.updateFolderInCache(parentPath, parentFolder);
  }

  public async deleteFile(requestedPath: string): Promise<void> {
    const account = await getAuthenticatedAccount(
      await this.getClientConfiguration(),
    );
    if (!account.isSftpDeletionEnabled) {
      throw new OperationNotAllowedError('You must enable SFTP deletion directly in your account settings.');
    }

    if (!isItemPath(requestedPath)) {
      throw new InvalidOperationForPathError('Invalid file path');
    }

    const archiveRecord = await this.loadArchiveRecord(
      requestedPath,
    );

    await deleteArchiveRecord(
      await this.getClientConfiguration(),
      {
        archiveRecordId: archiveRecord.id,
      },
    );
  }

  public async loadFile(
    requestedPath: string,
    overrideCache = false,
  ): Promise<File> {
    if (!isItemPath(requestedPath)) {
      throw new InvalidOperationForPathError('Invalid file path');
    }
    const archiveRecord = await this.loadArchiveRecord(
      requestedPath,
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
      const targetIndex = archiveFolders.findIndex((candidateFolder) => (
        candidateFolder.name === folder.name
      ));
      archiveFolders[targetIndex] = folder;
      this.archiveFoldersCache.set(archiveId, archiveFolders);
    } else {
      this.folderCache.set(folderPath, folder);
    }
  }

  public folderPathExistsInCache(itemPath: string): boolean {
    if (this.folderCache.has(itemPath)) {
      return true;
    }
    const parentPath = path.dirname(itemPath);
    const folderName = path.basename(itemPath);
    const parentFolder = this.folderCache.get(parentPath);
    if (!parentFolder) {
      return false;
    }
    const foundFolder = parentFolder.folders.find(
      (folder) => folder.fileSystemCompatibleName === folderName,
    );
    return foundFolder !== undefined;
  }

  public archiveRecordPathExistsInCache(itemPath: string): boolean {
    if (this.archiveRecordCache.has(itemPath)) {
      return true;
    }
    const parentPath = path.dirname(itemPath);
    const archiveRecordName = path.basename(itemPath);
    const parentFolder = this.folderCache.get(parentPath);
    if (!parentFolder) {
      return false;
    }
    const foundArchiveRecord = parentFolder.archiveRecords.find(
      (folder) => folder.fileSystemCompatibleName === archiveRecordName,
    );
    return foundArchiveRecord !== undefined;
  }

  private async loadArchiveRecord(
    requestedPath: string,
    overrideCache = false,
  ): Promise<ArchiveRecord> {
    const cachedArchiveRecord = this.archiveRecordCache.get(requestedPath);
    if (cachedArchiveRecord && !overrideCache) {
      return cachedArchiveRecord;
    }
    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const populatedArchiveRecord = await this.findArchiveRecordInParentDirectory(
      parentPath,
      childName,
    );
    this.archiveRecordCache.set(requestedPath, populatedArchiveRecord);
    return populatedArchiveRecord;
  }

  private async getClientConfiguration(): Promise<ClientConfiguration> {
    const authToken = await this.authTokenManager.getAuthToken();
    return {
      bearerToken: authToken,
      baseUrl: process.env.PERMANENT_API_BASE_PATH,
      stelaBaseUrl: process.env.STELA_API_BASE_PATH,
      retryOn: [500, 502, 503, 504],
    };
  }

  private async loadArchives(): Promise<Archive[]> {
    if (!this.archivesCache) {
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
      throw new ResourceDoesNotExistError('An archive with that slug could not be found');
    }
    return archive;
  }

  private async loadArchiveIdFromPath(itemPath: string): Promise<number> {
    const archiveSlug = getArchiveSlugFromPath(itemPath);
    const archive = await this.loadArchiveByArchiveSlug(archiveSlug);
    return archive.id;
  }

  private async loadArchiveFolders(archiveId: number): Promise<Folder[]> {
    const cachedArchiveFolders = this.archiveFoldersCache.get(archiveId);
    if (cachedArchiveFolders) {
      return cachedArchiveFolders;
    }
    const archiveFolders = await getArchiveFolders(
      await this.getClientConfiguration(),
      {
        archiveId,
      },
    );
    this.archiveFoldersCache.set(archiveId, archiveFolders);
    return archiveFolders;
  }

  private async loadArchive(requestedPath: string): Promise<Archive> {
    if (!isArchivePath(requestedPath)) {
      throw new InvalidOperationForPathError('The requested path is not an archive');
    }
    const archiveSlug = getArchiveSlugFromPath(requestedPath);
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
      throw new ResourceDoesNotExistError(`The specified folder does not exist (${parentPath}/${folderName})`);
    }
    return targetFolder ?? this.findFolderInParentDirectory(
      parentPath,
      folderName,
      true,
    );
  }

  private async findArchiveRecordInParentDirectory(
    parentPath: string,
    archiveRecordName: string,
    overrideParentCache = false,
  ): Promise<ArchiveRecord> {
    const parentFolder = await this.loadFolder(
      parentPath,
      overrideParentCache,
    );
    const targetArchiveRecord = parentFolder.archiveRecords.find(
      (folder) => folder.fileSystemCompatibleName === archiveRecordName,
    );

    if (targetArchiveRecord) {
      return targetArchiveRecord;
    }
    if (overrideParentCache) {
      throw new ResourceDoesNotExistError('The specified archive record does not exist');
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
    requestedPath: string,
    overrideCache = false,
  ): Promise<Folder> {
    const cachedFolder = this.folderCache.get(requestedPath);
    if (cachedFolder && !overrideCache) {
      return cachedFolder;
    }

    if (!isItemPath(requestedPath)) {
      throw new InvalidOperationForPathError('The requested path is not a folder');
    }

    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const targetFolder = await this.findFolderInParentDirectory(
      parentPath,
      childName,
    );
    const populatedTargetFolder = await getFolder(
      await this.getClientConfiguration(),
      {
        folderId: targetFolder.id,
      },
    );
    this.folderCache.set(requestedPath, populatedTargetFolder);
    return populatedTargetFolder;
  }

  private async loadArchiveFileEntries(): Promise<FileEntry[]> {
    const archives = await this.loadArchives();
    return archives.map((archive: Archive) => generateFileEntry(
      `${archive.name} (${archive.slug})`,
      generateAttributesForArchive(archive),
    ));
  }

  private async loadArchiveFoldersFileEntries(archivePath: string): Promise<FileEntry[]> {
    const archiveId = await this.loadArchiveIdFromPath(archivePath);
    const folders = await this.loadArchiveFolders(archiveId);
    return folders.map((archiveFolder) => generateFileEntry(
      archiveFolder.fileSystemCompatibleName,
      generateAttributesForFolder(archiveFolder),
    ));
  }

  private async loadFolderFileEntries(
    requestedPath: string,
    overrideCache = false,
  ): Promise<FileEntry[]> {
    const childFolder = await this.loadFolder(
      requestedPath,
      overrideCache,
    );
    const folderFileEntities = generateFileEntriesForFolders(childFolder.folders);
    const archiveRecordFileEntities = generateFileEntriesForArchiveRecords(
      childFolder.archiveRecords,
    );
    return deduplicateFileEntries([
      ...folderFileEntities,
      ...archiveRecordFileEntities,
    ]);
  }
}
