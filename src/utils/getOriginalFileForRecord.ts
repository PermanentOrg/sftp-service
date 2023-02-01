import { DerivativeType } from '@permanentorg/sdk';
import type {
  File,
  Record,
} from '@permanentorg/sdk';

export const getOriginalFileForRecord = (record: Record): File => {
  const originalFile = record.files.find(
    (file) => file.derivativeType === DerivativeType.Original,
  );
  if (!originalFile) {
    throw Error(`Permanent does not have an original file for record ${record.id}`);
  }
  return originalFile;
};
