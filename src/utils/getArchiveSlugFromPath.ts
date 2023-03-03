export const getArchiveSlugFromPath = (archivePath: string): string => {
  const archiveIdPattern = /^\/archives\/[^/]* \(([^/]+)\)(\/.*)?$/;
  const matches = archiveIdPattern.exec(archivePath);
  if (matches === null) {
    throw new Error('The specified path did not contain an archive slug');
  }
  return matches[1];
};
