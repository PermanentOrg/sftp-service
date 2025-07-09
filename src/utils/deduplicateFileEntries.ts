import type { FileEntry } from "ssh2";

const findFirstIndexOfFilename = (
	fileEntries: FileEntry[],
	filename: string,
): number =>
	fileEntries.findIndex((fileEntry) => fileEntry.filename === filename);

const isFirstInstanceOfItsFilename = (
	fileEntry: FileEntry,
	index: number,
	fileEntries: FileEntry[],
): boolean =>
	index === findFirstIndexOfFilename(fileEntries, fileEntry.filename);

export const deduplicateFileEntries = (fileEntries: FileEntry[]): FileEntry[] =>
	fileEntries.filter(isFirstInstanceOfItsFilename);
