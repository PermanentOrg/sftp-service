import fs from "fs";
import { createTestFile, FILE_MODE } from "../test/factories";
import { generateAttributesForFile } from "./generateAttributesForFile";

describe("generateAttributesForFile", () => {
	describe("when given a file", () => {
		it("should set mode to regular file with full permissions", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.mode).toBe(FILE_MODE);
		});

		it("should use the file size", () => {
			const file = createTestFile({ size: 2048 });

			const result = generateAttributesForFile(file);

			expect(result.size).toBe(2048);
		});

		it("should convert updatedAt to unix timestamp for mtime", () => {
			const updatedAt = new Date("2024-06-15T10:30:00Z");
			const file = createTestFile({ updatedAt });

			const result = generateAttributesForFile(file);

			expect(result.mtime).toBe(updatedAt.getTime() / 1000);
		});

		it("should set uid and gid to 0", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.uid).toBe(0);
			expect(result.gid).toBe(0);
		});

		it("should set atime to 0", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.atime).toBe(0);
		});
	});

	describe("when not given a file", () => {
		it("should return default attributes with file mode", () => {
			const result = generateAttributesForFile(undefined);

			expect(result.mode).toBe(FILE_MODE);
		});

		it("should set size to 0", () => {
			const result = generateAttributesForFile(undefined);

			expect(result.size).toBe(0);
		});

		it("should set all timestamps to 0", () => {
			const result = generateAttributesForFile(undefined);

			expect(result.atime).toBe(0);
			expect(result.mtime).toBe(0);
		});

		it("should set uid and gid to 0", () => {
			const result = generateAttributesForFile(undefined);

			expect(result.uid).toBe(0);
			expect(result.gid).toBe(0);
		});
	});

	describe("when called without arguments", () => {
		it("should return default attributes", () => {
			const result = generateAttributesForFile();

			expect(result.mode).toBe(FILE_MODE);
			expect(result.size).toBe(0);
			expect(result.uid).toBe(0);
			expect(result.gid).toBe(0);
			expect(result.atime).toBe(0);
			expect(result.mtime).toBe(0);
		});
	});

	describe("mode verification", () => {
		it("should have the regular file type bit set", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		});

		it("should have read/write/execute for user", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		});

		it("should have read/write/execute for group", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		});

		it("should have read/write/execute for others", () => {
			const file = createTestFile();

			const result = generateAttributesForFile(file);

			expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
		});
	});
});
