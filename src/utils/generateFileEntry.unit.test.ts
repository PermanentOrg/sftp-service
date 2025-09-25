import fs from "fs";
import { generateFileEntry } from "./generateFileEntry";
import type { Attributes } from "ssh2";

const createAttributes = (overrides: Partial<Attributes> = {}): Attributes => ({
	mode: fs.constants.S_IFREG | 0o644,
	uid: 0,
	gid: 0,
	size: 1024,
	atime: 0,
	mtime: 0,
	...overrides
});

describe("generateFileEntry", () => {
	it("should generate file entry with correct filename", () => {
		const attributes = createAttributes();
		const result = generateFileEntry("/path/to/file.txt", attributes);

		expect(result.filename).toBe("/path/to/file.txt");
		expect(result.attrs).toBe(attributes);
	});

	it("should generate longname with basename of file path", () => {
		const attributes = createAttributes();
		const result = generateFileEntry("/path/to/document.pdf", attributes);

		expect(result.longname).toContain("document.pdf");
		expect(result.longname).toMatch(/^-rwxrwxrwx 1 nobody nogroup document\.pdf$/);
	});

	it("should handle nested file paths correctly", () => {
		const attributes = createAttributes({
			mode: fs.constants.S_IFDIR | 0o755,
			size: 4096
		});
		const result = generateFileEntry("/archives/My Archive (slug)/nested/folder", attributes);

		expect(result.filename).toBe("/archives/My Archive (slug)/nested/folder");
		expect(result.longname).toContain("folder");
		expect(result.longname).toMatch(/^drwxrwxrwx 1 nobody nogroup folder$/);
	});

	it("should preserve file attributes", () => {
		const attributes = createAttributes({
			uid: 1000,
			gid: 1000,
			size: 2048,
			atime: 123456789,
			mtime: 987654321
		});
		const result = generateFileEntry("test.txt", attributes);

		expect(result.attrs).toEqual(attributes);
		expect(result.attrs.uid).toBe(1000);
		expect(result.attrs.gid).toBe(1000);
		expect(result.attrs.size).toBe(2048);
		expect(result.attrs.atime).toBe(123456789);
		expect(result.attrs.mtime).toBe(987654321);
	});

	it("should handle root file path", () => {
		const attributes = createAttributes();
		const result = generateFileEntry("file.txt", attributes);

		expect(result.filename).toBe("file.txt");
		expect(result.longname).toContain("file.txt");
	});

	it("should handle file with no extension", () => {
		const attributes = createAttributes();
		const result = generateFileEntry("/path/to/README", attributes);

		expect(result.filename).toBe("/path/to/README");
		expect(result.longname).toContain("README");
	});

	it("should handle files with special characters in name", () => {
		const attributes = createAttributes();
		const result = generateFileEntry("/path/file@#$%.txt", attributes);

		expect(result.filename).toBe("/path/file@#$%.txt");
		expect(result.longname).toContain("file@#$%.txt");
	});

	it("should differentiate file and directory entries", () => {
		const fileAttributes = createAttributes();
		const dirAttributes = createAttributes({
			mode: fs.constants.S_IFDIR | 0o755,
			size: 4096
		});

		const fileEntry = generateFileEntry("/path/file.txt", fileAttributes);
		const dirEntry = generateFileEntry("/path/directory", dirAttributes);

		expect(fileEntry.longname.startsWith("-")).toBe(true);
		expect(dirEntry.longname.startsWith("d")).toBe(true);
	});
});