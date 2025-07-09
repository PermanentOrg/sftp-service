import fs from "fs";
import { generateFileEntry } from "./generateFileEntry";
import { generateDefaultAttributes } from "./generateDefaultAttributes";
import type { Folder } from "@permanentorg/sdk";
import type { FileEntry } from "ssh2";

export const generateFileEntriesForFolders = (folders: Folder[]): FileEntry[] =>
	folders.map((folder) =>
		generateFileEntry(
			folder.fileSystemCompatibleName,
			generateDefaultAttributes(fs.constants.S_IFDIR),
		),
	);
