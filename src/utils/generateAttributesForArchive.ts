import fs from "node:fs";
import { DEFAULT_FILE_ATTRIBUTES, MS_PER_SECOND } from "../constants";
import { generateDefaultMode } from "./generateDefaultMode";
import type { Attributes } from "ssh2";
import type { Archive } from "@permanentorg/sdk";

export const generateAttributesForArchive = (archive: Archive): Attributes => ({
	mode: generateDefaultMode(fs.constants.S_IFDIR),
	uid: DEFAULT_FILE_ATTRIBUTES.USER_ID,
	gid: DEFAULT_FILE_ATTRIBUTES.GROUP_ID,
	size: DEFAULT_FILE_ATTRIBUTES.SIZE,
	atime: DEFAULT_FILE_ATTRIBUTES.ACCESS_TIME,
	mtime: archive.updatedAt.getTime() / MS_PER_SECOND,
});
