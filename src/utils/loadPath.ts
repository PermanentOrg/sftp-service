import fs from 'fs';
import {
  getArchives,
  getArchiveFolders,
} from '@permanentorg/sdk';
import { generateDefaultAttributes } from './generateDefaultAttributes';
import { generateFileEntry } from './generateFileEntry';
import type { FileEntry } from 'ssh2';
import type { Archive } from '@permanentorg/sdk';

const loadArchives = async (authToken: string): Promise<FileEntry[]> => {
  const archives = await getArchives({
    bearerToken: authToken,
    baseUrl: process.env.PERMANENT_API_BASE_PATH,
  });
  return archives.map((archive: Archive) => {
    const archiveDirectoryPath = `/archives/${archive.name} (${archive.id})`;
    return generateFileEntry(
      archiveDirectoryPath,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    );
  });
};

const getArchiveIdFromArchivePath = (archivePath: string): number => {
  const archiveIdPattern = /^.* \((\d+)\)$/;
  const matches = archiveIdPattern.exec(archivePath);
  if (matches === null) {
    return -1;
  }
  return parseInt(matches[1], 10);
};

const loadArchive = async (authToken: string, requestedPath: string): Promise<FileEntry[]> => {
  const archiveFolders = await getArchiveFolders(
    {
      bearerToken: authToken,
      baseUrl: process.env.PERMANENT_API_BASE_PATH,
    },
    getArchiveIdFromArchivePath(requestedPath),
  );
  return archiveFolders.map((archiveFolder) => generateFileEntry(
    `${requestedPath}/${archiveFolder.name}`,
    generateDefaultAttributes(fs.constants.S_IFDIR),
  ));
};

const isRootPath = (requestedPath: string): boolean => (
  requestedPath === '/'
);

const isArchiveCataloguePath = (requestedPath: string): boolean => (
  requestedPath === '/archives'
);

const isArchiveRootPath = (requestedPath: string): boolean => (
  requestedPath.startsWith('/archives')
  && requestedPath.split('/').length === 3
);

export const loadPath = async (requestedPath: string, authToken: string): Promise<FileEntry[]> => {
  if (isRootPath(requestedPath)) {
    return [
      generateFileEntry(
        '/archives',
        generateDefaultAttributes(fs.constants.S_IFDIR),
      ),
    ];
  }
  if (isArchiveCataloguePath(requestedPath)) {
    return loadArchives(authToken);
  }
  if (isArchiveRootPath(requestedPath)) {
    return loadArchive(
      authToken,
      requestedPath,
    );
  }
  return [];
};
