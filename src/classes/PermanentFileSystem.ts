import path from 'path';
import fs from 'fs';
import {
  getArchives,
  getArchiveFolders,
  getFolder,
  getRecord,
} from '@permanentorg/sdk';
import {
  deduplicateFileEntries,
  generateAttributesForFile,
  generateAttributesForFolder,
  generateDefaultAttributes,
  generateFileEntry,
  generateFileEntriesForRecords,
  generateFileEntriesForFolders,
  getArchiveIdFromPath,
  getOriginalFileForRecord,
} from '../utils';
import type {
  Archive,
  ClientConfiguration,
  Folder,
  File,
  Record,
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

  private readonly recordCache = new Map<string, Record>();

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
    const targetIsRecord = parentFolder.records.some(
      (record) => record.fileSystemCompatibleName === childName,
    );
    if (targetIsRecord) {
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

  public async loadFile(requestedPath: string): Promise<File> {
    if (!isItemPath(requestedPath)) {
      throw new Error('Invalid file path');
    }
    const record = await this.loadRecord(requestedPath);
    return getOriginalFileForRecord(record);
  }

  private async loadRecord(requestedPath: string): Promise<Record> {
    const cachedRecord = this.recordCache.get(requestedPath);
    if (cachedRecord) {
      return cachedRecord;
    }
    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const parentFolder = await this.loadFolder(parentPath);
    const archiveId = getArchiveIdFromPath(parentPath);
    const targetRecord = parentFolder.records.find(
      (record) => record.fileSystemCompatibleName === childName,
    );
    if (!targetRecord) {
      throw new Error('This file does not exist');
    }
    const populatedRecord = await getRecord(
      this.getClientConfiguration(),
      targetRecord.id,
      archiveId,
    );
    this.recordCache.set(requestedPath, populatedRecord);
    return populatedRecord;
  }

  private async loadRecords(requestedPaths: string[]): Promise<Record[]> {
    // See https://github.com/PermanentOrg/permanent-sdk/issues/73
    // This implementation is intentionally sequential even though using
    // requestedPaths.map would allow us to run all of the lookups in parallel.
    // This decision is because I'm worried about crushing the Permanent server
    // if a given folder had a huge number of records.
    return requestedPaths.reduce<Promise<Record[]>>(
      async (
        recordsPromise,
        requestedPath,
      ) => {
        const records = await recordsPromise;
        return [
          ...records,
          await this.loadRecord(requestedPath),
        ];
      },
      Promise.resolve([]),
    );
  }

  private async loadDeepRecords(
    records: Record[],
    basePath: string,
  ): Promise<Record[]> {
    // TODO: this method exists due to a limitation of the permanent SDK, which
    // currently only returns shallow records.  We want deep records.
    // See https://github.com/PermanentOrg/permanent-sdk/issues/73
    const recordPaths = records.map(
      (record) => `${basePath}/${record.fileSystemCompatibleName}`,
    );
    return this.loadRecords(recordPaths);
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
    const recordFileEntities = generateFileEntriesForRecords(
      await this.loadDeepRecords(
        childFolder.records,
        requestedPath,
      ),
    );
    return deduplicateFileEntries([
      ...folderFileEntities,
      ...recordFileEntities,
    ]);
  }
}
