import path from 'path';
import fs from 'fs';
import {
  createFolder,
  getArchives,
  getArchiveFolders,
  getFolder,
  getArchiveRecord,
} from '@permanentorg/sdk';
import {
  deduplicateFileEntries,
  generateAttributesForFile,
  generateAttributesForFolder,
  generateDefaultAttributes,
  generateFileEntry,
  generateFileEntriesForArchiveRecords,
  generateFileEntriesForFolders,
  getArchiveIdFromPath,
  getOriginalFileForArchiveRecord,
} from '../utils';
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

  private readonly authToken;

  public constructor(authToken: string) {
    this.authToken = authToken;
  }

  private static loadRootFileEntries(): FileEntry[] {
    return [
      generateFileEntry(
        'archives',
        generateDefaultAttributes(fs.constants.S_IFDIR),
      ),
    ];
  }

  public async getItemType(itemPath: string): Promise<number> {
    if (isRootPath(itemPath)
     || isArchiveCataloguePath(itemPath)
     || isArchivePath(itemPath)
     || isArchiveChildFolderPath(itemPath)
    ) {
      return fs.constants.S_IFDIR;
    }
    const parentPath = path.dirname(itemPath);
    const childName = path.basename(itemPath);
    const parentFolder = await this.loadFolder(parentPath);
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
    throw new Error('Item was not found');
  }

  public async getItemAttributes(itemPath: string): Promise<Attributes> {
    if (isRootPath(itemPath)
     || isArchiveCataloguePath(itemPath)
     || isArchivePath(itemPath)) {
      return generateDefaultAttributes(fs.constants.S_IFDIR);
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
        throw new Error('The specified path is neither a file nor a directory.');
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

  public async makeDirectory(requestedPath: string): Promise<Folder> {
    if (isRootPath(requestedPath)) {
      throw new Error('You cannot create new root level folders via SFTP.');
    }
    if (isArchiveCataloguePath(requestedPath)) {
      throw new Error('You cannot create new archives via SFTP.');
    }
    if (isArchivePath(requestedPath)) {
      throw new Error('You cannot create new folders at the root level of an archive via SFTP.');
    }
    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const parentFolder = await this.loadFolder(parentPath);
    this.folderCache.delete(parentPath);
    return createFolder(
      this.getClientConfiguration(),
      {
        name: childName,
      },
      parentFolder,
    );
  }

  public async loadFile(requestedPath: string): Promise<File> {
    if (!isItemPath(requestedPath)) {
      throw new Error('Invalid file path');
    }
    const archiveRecord = await this.loadArchiveRecord(requestedPath);
    return getOriginalFileForArchiveRecord(archiveRecord);
  }

  private async loadArchiveRecord(requestedPath: string): Promise<ArchiveRecord> {
    const cachedArchiveRecord = this.archiveRecordCache.get(requestedPath);
    if (cachedArchiveRecord) {
      return cachedArchiveRecord;
    }
    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const parentFolder = await this.loadFolder(parentPath);
    const archiveId = getArchiveIdFromPath(parentPath);
    const targetArchiveRecord = parentFolder.archiveRecords.find(
      (archiveRecord) => archiveRecord.fileSystemCompatibleName === childName,
    );
    if (!targetArchiveRecord) {
      throw new Error('This file does not exist');
    }
    const populatedArchiveRecord = await getArchiveRecord(
      this.getClientConfiguration(),
      targetArchiveRecord.id,
      archiveId,
    );
    this.archiveRecordCache.set(requestedPath, populatedArchiveRecord);
    return populatedArchiveRecord;
  }

  private async loadArchiveRecords(requestedPaths: string[]): Promise<ArchiveRecord[]> {
    // See https://github.com/PermanentOrg/permanent-sdk/issues/73
    // This implementation is intentionally sequential even though using
    // requestedPaths.map would allow us to run all of the lookups in parallel.
    // This decision is because I'm worried about crushing the Permanent server
    // if a given folder had a huge number of archive records.
    return requestedPaths.reduce<Promise<ArchiveRecord[]>>(
      async (
        archiveRecordsPromise,
        requestedPath,
      ) => {
        const archiveRecords = await archiveRecordsPromise;
        return [
          ...archiveRecords,
          await this.loadArchiveRecord(requestedPath),
        ];
      },
      Promise.resolve([]),
    );
  }

  private async loadDeepArchiveRecords(
    archiveRecords: ArchiveRecord[],
    basePath: string,
  ): Promise<ArchiveRecord[]> {
    // TODO: this method exists due to a limitation of the permanent SDK, which
    // currently only returns shallow archive records.  We want deep archive records.
    // See https://github.com/PermanentOrg/permanent-sdk/issues/73
    const archiveRecordPaths = archiveRecords.map(
      (archiveRecord) => `${basePath}/${archiveRecord.fileSystemCompatibleName}`,
    );
    return this.loadArchiveRecords(archiveRecordPaths);
  }

  private getClientConfiguration(): ClientConfiguration {
    return {
      bearerToken: this.authToken,
      baseUrl: process.env.PERMANENT_API_BASE_PATH,
    };
  }

  private async loadArchives(): Promise<Archive[]> {
    if (!this.archivesCache) {
      this.archivesCache = await getArchives(
        this.getClientConfiguration(),
      );
    }
    return this.archivesCache;
  }

  private async loadArchiveFolders(archiveId: number): Promise<Folder[]> {
    const cachedArchiveFolders = this.archiveFoldersCache.get(archiveId);
    if (cachedArchiveFolders) {
      return cachedArchiveFolders;
    }
    const archiveFolders = await getArchiveFolders(
      this.getClientConfiguration(),
      archiveId,
    );
    this.archiveFoldersCache.set(archiveId, archiveFolders);
    return archiveFolders;
  }

  private async loadFolder(requestedPath: string): Promise<Folder> {
    const cachedFolder = this.folderCache.get(requestedPath);
    if (cachedFolder) {
      return cachedFolder;
    }

    if (!isItemPath(requestedPath)) {
      throw new Error('The requested path cannot be a folder');
    }

    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const archiveId = getArchiveIdFromPath(parentPath);
    const childFolders = isArchivePath(parentPath)
      ? await this.loadArchiveFolders(archiveId)
      : (await this.loadFolder(parentPath)).folders;
    const targetFolder = childFolders.find(
      (folder) => folder.fileSystemCompatibleName === childName,
    );
    if (!targetFolder) {
      throw new Error();
    }
    const populatedTargetFolder = await getFolder(
      this.getClientConfiguration(),
      targetFolder.id,
      archiveId,
    );
    this.folderCache.set(requestedPath, populatedTargetFolder);
    return populatedTargetFolder;
  }

  private async loadArchiveFileEntries(): Promise<FileEntry[]> {
    const archives = await this.loadArchives();
    return archives.map((archive: Archive) => generateFileEntry(
      `${archive.name} (${archive.id})`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ));
  }

  private async loadArchiveFoldersFileEntries(archivePath: string): Promise<FileEntry[]> {
    const archiveId = getArchiveIdFromPath(archivePath);
    const folders = await this.loadArchiveFolders(archiveId);
    return folders.map((archiveFolder) => generateFileEntry(
      `${archiveFolder.fileSystemCompatibleName}`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ));
  }

  private async loadFolderFileEntries(requestedPath: string): Promise<FileEntry[]> {
    const childFolder = await this.loadFolder(requestedPath);
    const folderFileEntities = generateFileEntriesForFolders(childFolder.folders);
    const archiveRecordFileEntities = generateFileEntriesForArchiveRecords(
      await this.loadDeepArchiveRecords(
        childFolder.archiveRecords,
        requestedPath,
      ),
    );
    return deduplicateFileEntries([
      ...folderFileEntities,
      ...archiveRecordFileEntities,
    ]);
  }
}
