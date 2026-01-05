import { createTestFolder, DIRECTORY_MODE } from "../test/factories";
import { generateFileEntriesForFolders } from "./generateFileEntriesForFolders";

describe("generateFileEntriesForFolders", () => {
	it("should return an empty array when given an empty array", () => {
		const result = generateFileEntriesForFolders([]);

		expect(result).toEqual([]);
	});

	it("should generate a file entry for a single folder", () => {
		const folder = createTestFolder({
			fileSystemCompatibleName: "my-folder",
		});

		const result = generateFileEntriesForFolders([folder]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("my-folder");
	});

	it("should use directory mode for folder entries", () => {
		const folder = createTestFolder();

		const result = generateFileEntriesForFolders([folder]);

		expect(result[0].attrs.mode).toBe(DIRECTORY_MODE);
	});

	it("should generate file entries for multiple folders", () => {
		const folders = [
			createTestFolder({ fileSystemCompatibleName: "folder-a" }),
			createTestFolder({ fileSystemCompatibleName: "folder-b" }),
			createTestFolder({ fileSystemCompatibleName: "folder-c" }),
		];

		const result = generateFileEntriesForFolders(folders);

		expect(result).toHaveLength(3);
		expect(result[0].filename).toBe("folder-a");
		expect(result[1].filename).toBe("folder-b");
		expect(result[2].filename).toBe("folder-c");
	});

	it("should preserve folder order in output", () => {
		const folders = [
			createTestFolder({ fileSystemCompatibleName: "zebra" }),
			createTestFolder({ fileSystemCompatibleName: "apple" }),
		];

		const result = generateFileEntriesForFolders(folders);

		expect(result[0].filename).toBe("zebra");
		expect(result[1].filename).toBe("apple");
	});
});
