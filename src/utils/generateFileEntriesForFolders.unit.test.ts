import fs from "fs";
import { generateFileEntriesForFolders } from "./generateFileEntriesForFolders";
import type { Folder } from "@permanentorg/sdk";

describe("generateFileEntriesForFolders", () => {
	it("should return empty array for empty input", () => {
		const result = generateFileEntriesForFolders([]);
		expect(result).toEqual([]);
	});

	it("should generate file entries for single folder", () => {
		const folder: Partial<Folder> = {
			fileSystemCompatibleName: "Documents"
		};

		const result = generateFileEntriesForFolders([folder as Folder]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("Documents");
		expect(result[0].longname).toContain("Documents");
		expect(result[0].longname.startsWith("d")).toBe(true); // Directory flag
		expect(result[0].attrs.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
	});

	it("should generate file entries for multiple folders", () => {
		const folders: Partial<Folder>[] = [
			{ fileSystemCompatibleName: "Documents" },
			{ fileSystemCompatibleName: "Photos" },
			{ fileSystemCompatibleName: "Videos" }
		];

		const result = generateFileEntriesForFolders(folders as Folder[]);

		expect(result).toHaveLength(3);
		expect(result.map(entry => entry.filename)).toEqual(["Documents", "Photos", "Videos"]);

		result.forEach(entry => {
			expect(entry.longname.startsWith("d")).toBe(true);
			expect(entry.attrs.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		});
	});

	it("should handle folders with special characters in names", () => {
		const folders: Partial<Folder>[] = [
			{ fileSystemCompatibleName: "Folder with spaces" },
			{ fileSystemCompatibleName: "Folder@#$%" },
			{ fileSystemCompatibleName: "Folder-with-hyphens" }
		];

		const result = generateFileEntriesForFolders(folders as Folder[]);

		expect(result).toHaveLength(3);
		expect(result[0].filename).toBe("Folder with spaces");
		expect(result[1].filename).toBe("Folder@#$%");
		expect(result[2].filename).toBe("Folder-with-hyphens");

		result.forEach(entry => {
			expect(entry.longname).toContain(entry.filename);
		});
	});

	it("should set correct attributes for all folders", () => {
		const folders: Partial<Folder>[] = [
			{ fileSystemCompatibleName: "TestFolder1" },
			{ fileSystemCompatibleName: "TestFolder2" }
		];

		const result = generateFileEntriesForFolders(folders as Folder[]);

		result.forEach(entry => {
			expect(entry.attrs.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
			expect(entry.attrs.uid).toBe(0);
			expect(entry.attrs.gid).toBe(0);
			expect(entry.attrs.size).toBe(0);
			expect(entry.attrs.atime).toBe(0);
			expect(entry.attrs.mtime).toBe(0);
		});
	});

	it("should handle empty folder names", () => {
		const folders: Partial<Folder>[] = [
			{ fileSystemCompatibleName: "" }
		];

		const result = generateFileEntriesForFolders(folders as Folder[]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("");
		expect(result[0].longname).toContain(" "); // Should still contain the empty filename
	});
});