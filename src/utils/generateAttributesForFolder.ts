import fs from "node:fs";
import { DEFAULT_FILE_ATTRIBUTES, MS_PER_SECOND } from "../constants";
import { generateDefaultMode } from "./generateDefaultMode";
import type { Attributes } from "ssh2";
import type { Folder } from "@permanentorg/sdk";

export const generateAttributesForFolder = (folder: Folder): Attributes => ({
	mode: generateDefaultMode(fs.constants.S_IFDIR),
	uid: DEFAULT_FILE_ATTRIBUTES.USER_ID,
	gid: DEFAULT_FILE_ATTRIBUTES.GROUP_ID,
	size: folder.size,
	atime: DEFAULT_FILE_ATTRIBUTES.ACCESS_TIME,
	mtime: folder.updatedAt.getTime() / MS_PER_SECOND,
});
