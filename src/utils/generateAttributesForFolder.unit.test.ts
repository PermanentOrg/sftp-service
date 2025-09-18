import fs from "fs";
import { generateAttributesForFolder } from "./generateAttributesForFolder";
import type { Folder } from "@permanentorg/sdk";

describe("generateAttributesForFolder", () => {
	it("should generate attributes for folder with correct properties", () => {
		const mockFolder: Partial<Folder> = {
			size: 4096,
			updatedAt: new Date("2024-01-15T10:30:00Z")
		};

		const result = generateAttributesForFolder(mockFolder as Folder);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(4096);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(mockFolder.updatedAt!.getTime() / 1000);
	});

	it("should convert updatedAt to unix timestamp", () => {
		const updateDate = new Date("2024-06-01T15:45:30Z");
		const mockFolder: Partial<Folder> = {
			size: 8192,
			updatedAt: updateDate
		};

		const result = generateAttributesForFolder(mockFolder as Folder);

		expect(result.mtime).toBe(updateDate.getTime() / 1000);
	});

	it("should always set mode as directory with full permissions", () => {
		const mockFolder: Partial<Folder> = {
			size: 2048,
			updatedAt: new Date()
		};

		const result = generateAttributesForFolder(mockFolder as Folder);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should handle different folder sizes", () => {
		const sizes = [0, 1024, 4096, 16384];

		sizes.forEach(size => {
			const mockFolder: Partial<Folder> = {
				size,
				updatedAt: new Date()
			};

			const result = generateAttributesForFolder(mockFolder as Folder);

			expect(result.size).toBe(size);
		});
	});

	it("should always set uid and gid to 0", () => {
		const mockFolder: Partial<Folder> = {
			size: 512,
			updatedAt: new Date()
		};

		const result = generateAttributesForFolder(mockFolder as Folder);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});

	it("should always set atime to 0", () => {
		const mockFolder: Partial<Folder> = {
			size: 1024,
			updatedAt: new Date()
		};

		const result = generateAttributesForFolder(mockFolder as Folder);

		expect(result.atime).toBe(0);
	});
});