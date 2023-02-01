import { getOriginalFileForRecord } from './getOriginalFileForRecord';
import { generateFileEntry } from './generateFileEntry';
import { generateAttributesForFile } from './generateAttributesForFile';
import type { Record } from '@permanentorg/sdk';
import type { FileEntry } from 'ssh2';

export const generateFileEntriesForRecords = (
  records: Record[],
): FileEntry[] => records.reduce<FileEntry[]>(
  (fileEntries, record) => {
    const { fileName } = record;
    try {
      const file = getOriginalFileForRecord(record);
      return [
        ...fileEntries,
        generateFileEntry(
          fileName,
          generateAttributesForFile(file),
        ),
      ];
    } catch {
      return fileEntries;
    }
  },
  [],
);
