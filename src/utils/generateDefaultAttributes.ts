// We are living in the realm of bits for these operations
// and so we must accept our fate and use the bitwise operators.
/* eslint-disable no-bitwise */
import fs from 'fs';
import type { Attributes } from 'ssh2';

const generateDefaultMode = (baseType: number): number => (
  baseType
  | fs.constants.S_IRWXU // Read, write, execute for user
  | fs.constants.S_IRWXG // Read, write, execute for group
  | fs.constants.S_IRWXO // Read, write, execute for other
);

export const generateDefaultAttributes = (fileType: number): Attributes => ({
  mode: generateDefaultMode(fileType),
  uid: 0,
  gid: 0,
  size: 0,
  atime: 0,
  mtime: 0,
});
