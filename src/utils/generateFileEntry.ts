import path from 'path';
import { getLongname } from './getLongname';
import type {
  Attributes,
  FileEntry,
} from 'ssh2';

export const generateFileEntry = (
  filePath: string,
  attributes: Attributes,
): FileEntry => ({
  filename: filePath,
  longname: getLongname(
    path.basename(filePath),
    attributes,
  ),
  attrs: attributes,
});
