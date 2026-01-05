import { createTestAttributes } from "./createTestAttributes";
import type { Attributes, FileEntry } from "ssh2";

interface FileEntryOverrides {
	filename?: string;
	longname?: string;
	attrs?: Partial<Attributes>;
}

export const createTestFileEntry = (
	overrides: FileEntryOverrides = {},
): FileEntry => {
	const filename = overrides.filename ?? "test-file.txt";
	const attrs = createTestAttributes(overrides.attrs);
	const longname =
		overrides.longname ?? `-rwxrwxrwx 1 nobody nogroup ${filename}`;

	return {
		filename,
		longname,
		attrs,
	};
};
