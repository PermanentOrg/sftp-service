import fs from "fs";
import type { Attributes } from "ssh2";

export const FILE_MODE =
	fs.constants.S_IFREG |
	fs.constants.S_IRWXU |
	fs.constants.S_IRWXG |
	fs.constants.S_IRWXO;

export const DIRECTORY_MODE =
	fs.constants.S_IFDIR |
	fs.constants.S_IRWXU |
	fs.constants.S_IRWXG |
	fs.constants.S_IRWXO;

export const createTestAttributes = (
	overrides: Partial<Attributes> = {},
): Attributes => ({
	mode: FILE_MODE,
	uid: 0,
	gid: 0,
	size: 0,
	atime: 0,
	mtime: 0,
	...overrides,
});
