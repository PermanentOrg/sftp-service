import fs from "fs";
import { generateAttributesForArchive } from "./generateAttributesForArchive";
import type { Archive } from "@permanentorg/sdk";

describe("generateAttributesForArchive", () => {
	it("should generate attributes for archive with correct properties", () => {
		const mockArchive: Partial<Archive> = {
			updatedAt: new Date("2024-01-15T10:30:00Z")
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(mockArchive.updatedAt!.getTime() / 1000);
	});

	it("should convert updatedAt to unix timestamp", () => {
		const updateDate = new Date("2024-06-01T15:45:30Z");
		const mockArchive: Partial<Archive> = {
			updatedAt: updateDate
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.mtime).toBe(updateDate.getTime() / 1000);
	});

	it("should always set mode as directory with full permissions", () => {
		const mockArchive: Partial<Archive> = {
			updatedAt: new Date()
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should always set size to 0 for archives", () => {
		const mockArchive: Partial<Archive> = {
			updatedAt: new Date()
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.size).toBe(0);
	});

	it("should always set uid and gid to 0", () => {
		const mockArchive: Partial<Archive> = {
			updatedAt: new Date()
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});

	it("should always set atime to 0", () => {
		const mockArchive: Partial<Archive> = {
			updatedAt: new Date()
		};

		const result = generateAttributesForArchive(mockArchive as Archive);

		expect(result.atime).toBe(0);
	});

	it("should handle different update dates", () => {
		const dates = [
			new Date("2020-01-01T00:00:00Z"),
			new Date("2024-06-15T12:30:45Z"),
			new Date("2024-12-31T23:59:59Z")
		];

		dates.forEach(date => {
			const mockArchive: Partial<Archive> = {
				updatedAt: date
			};

			const result = generateAttributesForArchive(mockArchive as Archive);

			expect(result.mtime).toBe(date.getTime() / 1000);
		});
	});
});