const ARCHIVE_ID_PATTERN = /^\/archives\/[^/]* \(([^/]+)\)(\/.*)?$/;
const ARCHIVE_SLUG_MATCH_INDEX = 1;

export const getArchiveSlugFromPath = (archivePath: string): string => {
	const matches = ARCHIVE_ID_PATTERN.exec(archivePath);
	if (matches === null) {
		throw new Error("The specified path did not contain an archive slug");
	}
	return matches[ARCHIVE_SLUG_MATCH_INDEX];
};
