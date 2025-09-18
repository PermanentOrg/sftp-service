import { deduplicateFileEntries } from "./deduplicateFileEntries";
import type { FileEntry, Attributes } from "ssh2";

const createAttributes = (overrides: Partial<Attributes> = {}): Attributes => ({
	mode: 0o644,
	uid: 0,
	gid: 0,
	size: 1024,
	atime: 0,
	mtime: 0,
	...overrides
});

const createFileEntry = (filename: string, longname: string, attrOverrides: Partial<Attributes> = {}): FileEntry => ({
	filename,
	longname,
	attrs: createAttributes(attrOverrides)
});

describe("deduplicateFileEntries", () => {
	it("should return empty array when given empty array", () => {
		const result = deduplicateFileEntries([]);
		expect(result).toEqual([]);
	});

	it("should return single entry when given single entry", () => {
		const fileEntries: FileEntry[] = [
			createFileEntry("file1.txt", "file1")
		];
		const result = deduplicateFileEntries(fileEntries);
		expect(result).toEqual(fileEntries);
	});

	it("should remove duplicates when multiple entries have same filename", () => {
		const fileEntries: FileEntry[] = [
			createFileEntry("file1.txt", "first"),
			createFileEntry("file2.txt", "second", { size: 2048 }),
			createFileEntry("file1.txt", "duplicate")
		];
		const result = deduplicateFileEntries(fileEntries);
		expect(result).toHaveLength(2);
		expect(result[0].filename).toBe("file1.txt");
		expect(result[0].longname).toBe("first");
		expect(result[1].filename).toBe("file2.txt");
	});

	it("should keep first occurrence of each filename", () => {
		const fileEntries: FileEntry[] = [
			createFileEntry("duplicate.txt", "first"),
			createFileEntry("duplicate.txt", "second", { size: 2048 }),
			createFileEntry("duplicate.txt", "third", { size: 3072 })
		];
		const result = deduplicateFileEntries(fileEntries);
		expect(result).toHaveLength(1);
		expect(result[0].longname).toBe("first");
	});

	it("should handle multiple sets of duplicates", () => {
		const fileEntries: FileEntry[] = [
			createFileEntry("a.txt", "a1"),
			createFileEntry("b.txt", "b1", { size: 2048 }),
			createFileEntry("a.txt", "a2"),
			createFileEntry("c.txt", "c1", { size: 3072 }),
			createFileEntry("b.txt", "b2", { size: 2048 })
		];
		const result = deduplicateFileEntries(fileEntries);
		expect(result).toHaveLength(3);
		expect(result.map(entry => entry.filename)).toEqual(["a.txt", "b.txt", "c.txt"]);
		expect(result.map(entry => entry.longname)).toEqual(["a1", "b1", "c1"]);
	});
});