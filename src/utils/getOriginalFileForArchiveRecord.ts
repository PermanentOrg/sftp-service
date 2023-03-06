import { DerivativeType } from '@permanentorg/sdk';
import {
  IncompleteOriginalFileError,
  MissingOriginalFileError,
} from '../errors';
import type {
  File,
  ArchiveRecord,
} from '@permanentorg/sdk';

export const getOriginalFileForArchiveRecord = (archiveRecord: ArchiveRecord): File => {
  const originalFile = archiveRecord.files.find(
    (file) => file.derivativeType === DerivativeType.Original,
  );
  if (!originalFile) {
    throw new MissingOriginalFileError();
  }
  if (originalFile.downloadUrl === '') {
    throw new IncompleteOriginalFileError();
  }
  return originalFile;
};
