import { getOriginalFileForArchiveRecord } from './getOriginalFileForArchiveRecord';
import { generateFileEntry } from './generateFileEntry';
import { generateAttributesForFile } from './generateAttributesForFile';
import type { ArchiveRecord } from '@permanentorg/sdk';
import type { FileEntry } from 'ssh2';

export const generateFileEntriesForArchiveRecords = (
  archiveRecords: ArchiveRecord[],
): FileEntry[] => archiveRecords.reduce<FileEntry[]>(
  (fileEntries, archiveRecord) => {
    try {
      const file = getOriginalFileForArchiveRecord(archiveRecord);
      return [
        ...fileEntries,
        generateFileEntry(
          archiveRecord.fileSystemCompatibleName,
          generateAttributesForFile(file),
        ),
      ];
    } catch {
      return fileEntries;
    }
  },
  [],
);
