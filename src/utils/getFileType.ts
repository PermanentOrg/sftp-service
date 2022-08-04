import fs from 'fs';

export const getFileType = (filePath: string): number => {
  // TODO: this is not a real rule.
  // We are going to need to ultimately track what paths are files / folders
  // based on the information we get from the permanent backend (or the client)
  if (filePath.includes('.')) {
    return fs.constants.S_IFREG;
  }
  return fs.constants.S_IFDIR;
};
