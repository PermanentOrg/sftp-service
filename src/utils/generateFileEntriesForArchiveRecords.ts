import { getOriginalFileForArchiveRecord } from "./getOriginalFileForArchiveRecord.js";
import { generateFileEntry } from "./generateFileEntry.js";
import { generateAttributesForFile } from "./generateAttributesForFile.js";
import type { ArchiveRecord } from "@permanentorg/sdk";
import type { FileEntry } from "ssh2";

export const generateFileEntriesForArchiveRecords = (
	archiveRecords: ArchiveRecord[],
): FileEntry[] =>
	archiveRecords.reduce<FileEntry[]>((fileEntries, archiveRecord) => {
		try {
			const file = getOriginalFileForArchiveRecord(archiveRecord);
			return [
				...fileEntries,
				generateFileEntry(
					archiveRecord.fileSystemCompatibleName,
					generateAttributesForFile(file),
				),
			];
		} catch {
			return fileEntries;
		}
	}, []);
