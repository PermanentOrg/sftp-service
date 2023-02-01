export const getArchiveIdFromPath = (archivePath: string): number => {
  const archiveIdPattern = /^\/archives\/[^/]* \((\d+)\)(\/.*)?$/;
  const matches = archiveIdPattern.exec(archivePath);
  if (matches === null) {
    return -1;
  }
  return parseInt(matches[1], 10);
};
