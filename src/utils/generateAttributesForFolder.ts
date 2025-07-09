import fs from "fs";
import { generateDefaultMode } from "./generateDefaultMode";
import type { Attributes } from "ssh2";
import type { Folder } from "@permanentorg/sdk";

export const generateAttributesForFolder = (folder: Folder): Attributes => ({
	mode: generateDefaultMode(fs.constants.S_IFDIR),
	uid: 0,
	gid: 0,
	size: folder.size,
	atime: 0,
	mtime: folder.updatedAt.getTime() / 1000,
});
