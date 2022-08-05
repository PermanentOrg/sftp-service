import { generateDefaultMode } from './generateDefaultMode';
import type { Attributes } from 'ssh2';

export const generateDefaultAttributes = (fileType: number): Attributes => ({
  mode: generateDefaultMode(fileType),
  uid: 0,
  gid: 0,
  size: 0,
  atime: 0,
  mtime: 0,
});
