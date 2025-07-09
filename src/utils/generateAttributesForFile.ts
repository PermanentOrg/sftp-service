import fs from "fs";
import { generateDefaultMode } from "./generateDefaultMode";
import { generateDefaultAttributes } from "./generateDefaultAttributes";
import type { Attributes } from "ssh2";
import type { File } from "@permanentorg/sdk";

export const generateAttributesForFile = (file?: File): Attributes =>
	file !== undefined
		? {
				mode: generateDefaultMode(fs.constants.S_IFREG),
				uid: 0,
				gid: 0,
				size: file.size,
				atime: 0,
				mtime: file.updatedAt.getTime() / 1000,
			}
		: generateDefaultAttributes(fs.constants.S_IFREG);
