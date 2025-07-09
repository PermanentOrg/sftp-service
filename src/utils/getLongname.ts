// We are living in the realm of bits for these operations
// and so we must accept our fate and use the bitwise operators.
/* eslint-disable no-bitwise */
import fs from "fs";
import type { Attributes } from "ssh2";

const isDirectoryMode = (mode: number): boolean =>
	(mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;

export const getLongname = (
	filename: string,
	attributes: Attributes,
	owner = "nobody",
	group = "nogroup",
): string => {
	const directoryFlag = isDirectoryMode(attributes.mode) ? "d" : "-";
	return `${directoryFlag}rwxrwxrwx 1 ${owner} ${group} ${filename}`;
};
