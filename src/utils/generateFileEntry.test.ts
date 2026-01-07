import {
	createTestAttributes,
	DIRECTORY_MODE,
	FILE_MODE,
} from "../test/factories";
import { generateFileEntry } from "./generateFileEntry";

describe("generateFileEntry", () => {
	test("should use the full path as the filename", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("/path/to/file.txt", attributes);

		expect(result.filename).toBe("/path/to/file.txt");
	});

	test("should handle simple filenames without path", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("file.txt", attributes);

		expect(result.filename).toBe("file.txt");
	});

	test("should generate longname using basename for files", () => {
		const attributes = createTestAttributes({ mode: FILE_MODE });

		const result = generateFileEntry("/path/to/document.pdf", attributes);

		expect(result.longname).toBe("-rwxrwxrwx 1 nobody nogroup document.pdf");
	});

	test("should generate longname using basename for directories", () => {
		const attributes = createTestAttributes({ mode: DIRECTORY_MODE });

		const result = generateFileEntry("/path/to/my-folder", attributes);

		expect(result.longname).toBe("drwxrwxrwx 1 nobody nogroup my-folder");
	});

	test("should handle paths with multiple segments", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("/a/b/c/d/file.txt", attributes);

		expect(result.longname).toBe("-rwxrwxrwx 1 nobody nogroup file.txt");
	});

	test("should include the provided attributes in the result", () => {
		const attributes = createTestAttributes({
			mode: FILE_MODE,
			size: 1024,
			uid: 1000,
			gid: 1000,
		});

		const result = generateFileEntry("/path/to/file.txt", attributes);

		expect(result.attrs).toBe(attributes);
	});

	test("should preserve all attribute properties", () => {
		const attributes = createTestAttributes({
			mode: DIRECTORY_MODE,
			size: 4096,
			atime: 1700000000,
			mtime: 1700000001,
		});

		const result = generateFileEntry("/some/dir", attributes);

		expect(result.attrs.mode).toBe(DIRECTORY_MODE);
		expect(result.attrs.size).toBe(4096);
		expect(result.attrs.atime).toBe(1700000000);
		expect(result.attrs.mtime).toBe(1700000001);
	});

	test("should handle filenames with spaces", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("/path/to/my file.txt", attributes);

		expect(result.filename).toBe("/path/to/my file.txt");
		expect(result.longname).toBe("-rwxrwxrwx 1 nobody nogroup my file.txt");
	});

	test("should handle filenames with special characters", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("/path/to/file (copy).txt", attributes);

		expect(result.filename).toBe("/path/to/file (copy).txt");
		expect(result.longname).toBe("-rwxrwxrwx 1 nobody nogroup file (copy).txt");
	});

	test("should handle root-level files", () => {
		const attributes = createTestAttributes();

		const result = generateFileEntry("/file.txt", attributes);

		expect(result.filename).toBe("/file.txt");
		expect(result.longname).toBe("-rwxrwxrwx 1 nobody nogroup file.txt");
	});
});
