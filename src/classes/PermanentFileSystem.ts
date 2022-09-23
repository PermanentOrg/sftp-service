import path from 'path';
import fs from 'fs';
import {
  getArchives,
  getArchiveFolders,
  getFolder,
  getRecord,
  DerivativeType,
} from '@permanentorg/sdk';
import {
  generateDefaultAttributes,
  generateFileEntry,
} from '../utils';
import { generateAttributesForFile } from '../utils/generateAttributesForFile';
import type {
  Archive,
  ClientConfiguration,
  Folder,
  File,
  Record,
} from '@permanentorg/sdk';
import type { FileEntry } from 'ssh2';

const isRootPath = (requestedPath: string): boolean => (
  requestedPath === '/'
);

const isArchiveCataloguePath = (requestedPath: string): boolean => (
  requestedPath === '/archives'
);

const isArchivePath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length === 3
);

const isItemPath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length > 3
);

const getArchiveIdFromPath = (archivePath: string): number => {
  const archiveIdPattern = /^\/archives\/.* \((\d+)\)(\/.*)?$/;
  const matches = archiveIdPattern.exec(archivePath);
  if (matches === null) {
    return -1;
  }
  return parseInt(matches[1], 10);
};

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
    const originalFile = record.files.find(
      (file) => file.derivativeType === DerivativeType.Original,
    );
    if (!originalFile) {
      throw Error('Permanent does not have an original file for this record');
    }
    return originalFile;
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
      (record) => record.fileName === childName,
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

    const parentPath = path.dirname(requestedPath);
    const childName = path.basename(requestedPath);
    const archiveId = getArchiveIdFromPath(parentPath);
    const childFolders = isArchivePath(parentPath)
      ? await this.loadArchiveFolders(archiveId)
      : (await this.loadFolder(parentPath)).folders;
    const targetFolder = childFolders.find(
      (folder) => folder.name === childName,
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
      `${archiveFolder.name}`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ));
  }

  private async loadFolderFileEntries(requestedPath: string): Promise<FileEntry[]> {
    const childFolder = await this.loadFolder(requestedPath);
    const folderFileEntities = childFolder.folders.map(
      (folder) => generateFileEntry(
        `${folder.name}`,
        generateDefaultAttributes(fs.constants.S_IFDIR),
      ),
    );
    const recordFileEntities = await Promise.all(childFolder.records.map(
      async (record) => {
        const fileName = `${record.fileName}`;
        const filePath = `${requestedPath}/${fileName}`;
        const file = await this.loadFile(filePath);
        return generateFileEntry(
          fileName,
          generateAttributesForFile(file),
        );
      },
    ));
    return [
      ...folderFileEntities,
      ...recordFileEntities,
    ];
  }
}
