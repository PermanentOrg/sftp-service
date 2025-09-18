import fs from "fs";
import { getLongname } from "./getLongname";
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

describe("getLongname", () => {
	it("should generate longname for regular file with default owner/group", () => {
		const attributes = createAttributes({ mode: fs.constants.S_IFREG | 0o755 });
		const result = getLongname("file.txt", attributes);
		expect(result).toBe("-rwxrwxrwx 1 nobody nogroup file.txt");
	});

	it("should generate longname for directory with default owner/group", () => {
		const attributes = createAttributes({
			mode: fs.constants.S_IFDIR | 0o755,
			size: 4096
		});
		const result = getLongname("folder", attributes);
		expect(result).toBe("drwxrwxrwx 1 nobody nogroup folder");
	});

	it("should generate longname with custom owner and group", () => {
		const attributes = createAttributes({
			uid: 1000,
			gid: 1000,
			size: 2048
		});
		const result = getLongname("document.pdf", attributes, "user1", "staff");
		expect(result).toBe("-rwxrwxrwx 1 user1 staff document.pdf");
	});

	it("should handle directory type correctly", () => {
		const attributes = createAttributes({
			mode: fs.constants.S_IFDIR | 0o755,
			size: 4096
		});
		const result = getLongname("my-directory", attributes, "admin", "wheel");
		expect(result).toBe("drwxrwxrwx 1 admin wheel my-directory");
	});

	it("should handle files with spaces in name", () => {
		const attributes = createAttributes();
		const result = getLongname("file with spaces.txt", attributes);
		expect(result).toBe("-rwxrwxrwx 1 nobody nogroup file with spaces.txt");
	});

	it("should handle files with special characters", () => {
		const attributes = createAttributes({
			uid: 1000,
			gid: 1000,
			size: 512
		});
		const result = getLongname("file@#$%.txt", attributes, "test", "test");
		expect(result).toBe("-rwxrwxrwx 1 test test file@#$%.txt");
	});

	it("should handle empty filename", () => {
		const attributes = createAttributes({ size: 0 });
		const result = getLongname("", attributes);
		expect(result).toBe("-rwxrwxrwx 1 nobody nogroup ");
	});

	it("should differentiate between file and directory types", () => {
		const fileAttributes = createAttributes();
		const dirAttributes = createAttributes({
			mode: fs.constants.S_IFDIR | 0o755,
			size: 4096
		});

		const fileResult = getLongname("test", fileAttributes);
		const dirResult = getLongname("test", dirAttributes);

		expect(fileResult.startsWith("-")).toBe(true);
		expect(dirResult.startsWith("d")).toBe(true);
	});
});