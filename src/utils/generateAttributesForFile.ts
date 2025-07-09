import fs from "node:fs";
import { DEFAULT_FILE_ATTRIBUTES, MS_PER_SECOND } from "../constants";
import { generateDefaultMode } from "./generateDefaultMode";
import { generateDefaultAttributes } from "./generateDefaultAttributes";
import type { Attributes } from "ssh2";
import type { File } from "@permanentorg/sdk";

export const generateAttributesForFile = (file?: File): Attributes =>
	file !== undefined
		? {
				mode: generateDefaultMode(fs.constants.S_IFREG),
				uid: DEFAULT_FILE_ATTRIBUTES.USER_ID,
				gid: DEFAULT_FILE_ATTRIBUTES.GROUP_ID,
				size: file.size,
				atime: DEFAULT_FILE_ATTRIBUTES.ACCESS_TIME,
				mtime: file.updatedAt.getTime() / MS_PER_SECOND,
			}
		: generateDefaultAttributes(fs.constants.S_IFREG);
