import fs from "fs";
import { createTestFile, FILE_MODE } from "../test/factories";
import { generateAttributesForFile } from "./generateAttributesForFile";

describe("generateAttributesForFile", () => {
	test("should set mode to regular file with full permissions", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.mode).toBe(FILE_MODE);
	});

	test("should use the file size", () => {
		const file = createTestFile({ size: 2048 });

		const result = generateAttributesForFile(file);

		expect(result.size).toBe(2048);
	});

	test("should convert updatedAt to unix timestamp for mtime", () => {
		const updatedAt = new Date("2024-06-15T10:30:00Z");
		const file = createTestFile({ updatedAt });

		const result = generateAttributesForFile(file);

		expect(result.mtime).toBe(updatedAt.getTime() / 1000);
	});

	test("should set uid and gid to 0", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});

	test("should set atime to 0", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.atime).toBe(0);
	});

	test("should return default attributes with file mode when not given a file", () => {
		const result = generateAttributesForFile(undefined);

		expect(result.mode).toBe(FILE_MODE);
	});

	test("should set size to 0 when not given a file", () => {
		const result = generateAttributesForFile(undefined);

		expect(result.size).toBe(0);
	});

	test("should set all timestamps to 0 when not given a file", () => {
		const result = generateAttributesForFile(undefined);

		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	test("should set uid and gid to 0 when not given a file", () => {
		const result = generateAttributesForFile(undefined);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});

	test("should return default attributes when called without arguments", () => {
		const result = generateAttributesForFile();

		expect(result.mode).toBe(FILE_MODE);
		expect(result.size).toBe(0);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	test("should have the regular file type bit set", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
	});

	test("should have read/write/execute for user", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
	});

	test("should have read/write/execute for group", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
	});

	test("should have read/write/execute for others", () => {
		const file = createTestFile();

		const result = generateAttributesForFile(file);

		expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});
});
