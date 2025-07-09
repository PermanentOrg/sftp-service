import fs from "node:fs";
import { generateDefaultMode } from "./generateDefaultMode";
import type { Attributes } from "ssh2";
import type { Archive } from "@permanentorg/sdk";

export const generateAttributesForArchive = (archive: Archive): Attributes => ({
	mode: generateDefaultMode(fs.constants.S_IFDIR),
	uid: 0,
	gid: 0,
	size: 0,
	atime: 0,
	mtime: archive.updatedAt.getTime() / 1000,
});
