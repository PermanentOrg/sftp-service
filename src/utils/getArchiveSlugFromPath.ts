export const getArchiveSlugFromPath = (archivePath: string): string => {
	const archiveIdPattern = /^\/archives\/[^/]* \((?<slug>[^/]+)\)(?:\/.*)?$/;
	const matches = archiveIdPattern.exec(archivePath);
	if (matches?.groups?.slug === undefined) {
		throw new Error("The specified path did not contain an archive slug");
	}
	return matches.groups.slug;
};
