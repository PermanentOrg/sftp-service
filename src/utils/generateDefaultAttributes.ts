import { DEFAULT_FILE_ATTRIBUTES } from "../constants";
import { generateDefaultMode } from "./generateDefaultMode";
import type { Attributes } from "ssh2";

export const generateDefaultAttributes = (fileType: number): Attributes => ({
	mode: generateDefaultMode(fileType),
	uid: DEFAULT_FILE_ATTRIBUTES.USER_ID,
	gid: DEFAULT_FILE_ATTRIBUTES.GROUP_ID,
	size: DEFAULT_FILE_ATTRIBUTES.SIZE,
	atime: DEFAULT_FILE_ATTRIBUTES.ACCESS_TIME,
	mtime: DEFAULT_FILE_ATTRIBUTES.MODIFICATION_TIME,
});
