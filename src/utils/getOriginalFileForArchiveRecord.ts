import { DerivativeType } from "@permanentorg/sdk";
import type { File, ArchiveRecord } from "@permanentorg/sdk";

export const getOriginalFileForArchiveRecord = (
	archiveRecord: ArchiveRecord,
): File => {
	const originalFile = archiveRecord.files.find(
		(file) => file.derivativeType === DerivativeType.Original,
	);
	if (originalFile === undefined) {
		throw Error(
			`Permanent does not have an original file for Archive Record ${String(archiveRecord.id)}`,
		);
	}
	return originalFile;
};
