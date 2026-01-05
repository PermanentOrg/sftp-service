import { DerivativeType } from "@permanentorg/sdk";
import {
	createTestArchiveRecord,
	createTestFile,
	FILE_MODE,
} from "../test/factories";
import { generateFileEntriesForArchiveRecords } from "./generateFileEntriesForArchiveRecords";

describe("generateFileEntriesForArchiveRecords", () => {
	test("should return an empty array when given an empty array", () => {
		const result = generateFileEntriesForArchiveRecords([]);

		expect(result).toEqual([]);
	});

	test("should generate a file entry for a single archive record", () => {
		const archiveRecord = createTestArchiveRecord({
			fileSystemCompatibleName: "my-file.txt",
		});

		const result = generateFileEntriesForArchiveRecords([archiveRecord]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("my-file.txt");
	});

	test("should use file mode for archive record entries", () => {
		const archiveRecord = createTestArchiveRecord();

		const result = generateFileEntriesForArchiveRecords([archiveRecord]);

		expect(result[0].attrs.mode).toBe(FILE_MODE);
	});

	test("should use file size from the original file", () => {
		const originalFile = createTestFile({
			size: 12345,
			derivativeType: DerivativeType.Original,
		});
		const archiveRecord = createTestArchiveRecord({
			files: [originalFile],
		});

		const result = generateFileEntriesForArchiveRecords([archiveRecord]);

		expect(result[0].attrs.size).toBe(12345);
	});

	test("should generate file entries for multiple archive records", () => {
		const archiveRecords = [
			createTestArchiveRecord({ fileSystemCompatibleName: "file-a.txt" }),
			createTestArchiveRecord({ fileSystemCompatibleName: "file-b.txt" }),
			createTestArchiveRecord({ fileSystemCompatibleName: "file-c.txt" }),
		];

		const result = generateFileEntriesForArchiveRecords(archiveRecords);

		expect(result).toHaveLength(3);
		expect(result[0].filename).toBe("file-a.txt");
		expect(result[1].filename).toBe("file-b.txt");
		expect(result[2].filename).toBe("file-c.txt");
	});

	test("should skip archive records without original files", () => {
		const convertedFile = createTestFile({
			derivativeType: DerivativeType.Converted,
		});
		const archiveRecord = createTestArchiveRecord({
			files: [convertedFile],
		});

		const result = generateFileEntriesForArchiveRecords([archiveRecord]);

		expect(result).toEqual([]);
	});

	test("should skip archive records with empty files array", () => {
		const archiveRecord = createTestArchiveRecord({
			files: [],
		});

		const result = generateFileEntriesForArchiveRecords([archiveRecord]);

		expect(result).toEqual([]);
	});

	test("should include valid records and skip invalid ones", () => {
		const validRecord = createTestArchiveRecord({
			fileSystemCompatibleName: "valid.txt",
			files: [createTestFile({ derivativeType: DerivativeType.Original })],
		});
		const invalidRecord = createTestArchiveRecord({
			fileSystemCompatibleName: "invalid.txt",
			files: [createTestFile({ derivativeType: DerivativeType.Converted })],
		});
		const anotherValidRecord = createTestArchiveRecord({
			fileSystemCompatibleName: "also-valid.txt",
			files: [createTestFile({ derivativeType: DerivativeType.Original })],
		});

		const result = generateFileEntriesForArchiveRecords([
			validRecord,
			invalidRecord,
			anotherValidRecord,
		]);

		expect(result).toHaveLength(2);
		expect(result[0].filename).toBe("valid.txt");
		expect(result[1].filename).toBe("also-valid.txt");
	});

	test("should preserve archive record order in output", () => {
		const archiveRecords = [
			createTestArchiveRecord({ fileSystemCompatibleName: "zebra.txt" }),
			createTestArchiveRecord({ fileSystemCompatibleName: "apple.txt" }),
		];

		const result = generateFileEntriesForArchiveRecords(archiveRecords);

		expect(result[0].filename).toBe("zebra.txt");
		expect(result[1].filename).toBe("apple.txt");
	});
});
