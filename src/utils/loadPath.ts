import fs from 'fs';
import { getArchives } from '@permanentorg/sdk';
import { generateDefaultAttributes } from './generateDefaultAttributes';
import { generateFileEntry } from './generateFileEntry';
import type { FileEntry } from 'ssh2';
import type { Archive } from '@permanentorg/sdk';

const loadArchives = async (authToken: string): Promise<FileEntry[]> => {
  const archives = await getArchives({
    bearerToken: authToken,
  });
  return archives.map((archive: Archive) => {
    const archiveDirectoryPath = `/archives/${archive.name} (${archive.id})`;
    return generateFileEntry(
      archiveDirectoryPath,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    );
  });
};

// TODO - this is spoofed right now but will be replaced with appropriate SDK calls once
// that part of the SDK is released.
const loadArchive = async (authToken: string, archiveName: string): Promise<FileEntry[]> => [
  generateFileEntry(
    `${archiveName}/MyFiles`,
    generateDefaultAttributes(fs.constants.S_IFDIR),
  ),
  generateFileEntry(
    `${archiveName}/Shares`,
    generateDefaultAttributes(fs.constants.S_IFDIR),
  ),
  generateFileEntry(
    `${archiveName}/Public`,
    generateDefaultAttributes(fs.constants.S_IFDIR),
  ),
  generateFileEntry(
    `${archiveName}/Apps`,
    generateDefaultAttributes(fs.constants.S_IFDIR),
  ),
];

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
