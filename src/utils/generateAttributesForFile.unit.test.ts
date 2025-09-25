import fs from "fs";
import { generateAttributesForFile } from "./generateAttributesForFile";
import type { File } from "@permanentorg/sdk";

describe("generateAttributesForFile", () => {
	it("should generate default attributes when no file provided", () => {
		const result = generateAttributesForFile();

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	it("should generate default attributes when undefined file provided", () => {
		const result = generateAttributesForFile(undefined);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	it("should use file size when file object provided", () => {
		const mockFile: Partial<File> = {
			size: 1024,
			updatedAt: new Date("2024-01-01T10:00:00Z")
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(1024);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(mockFile.updatedAt!.getTime() / 1000);
	});

	it("should convert updatedAt to unix timestamp", () => {
		const updateDate = new Date("2024-06-15T14:30:00Z");
		const mockFile: Partial<File> = {
			size: 2048,
			updatedAt: updateDate
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.mtime).toBe(updateDate.getTime() / 1000);
	});

	it("should handle large file sizes", () => {
		const mockFile: Partial<File> = {
			size: 1073741824, // 1GB
			updatedAt: new Date()
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.size).toBe(1073741824);
	});

	it("should handle zero file size", () => {
		const mockFile: Partial<File> = {
			size: 0,
			updatedAt: new Date()
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.size).toBe(0);
	});

	it("should always set mode as regular file with full permissions", () => {
		const mockFile: Partial<File> = {
			size: 100,
			updatedAt: new Date()
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should always set uid and gid to 0", () => {
		const mockFile: Partial<File> = {
			size: 500,
			updatedAt: new Date()
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});

	it("should always set atime to 0", () => {
		const mockFile: Partial<File> = {
			size: 500,
			updatedAt: new Date()
		};

		const result = generateAttributesForFile(mockFile as File);

		expect(result.atime).toBe(0);
	});
});