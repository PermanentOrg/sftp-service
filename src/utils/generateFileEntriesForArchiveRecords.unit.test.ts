import { DerivativeType } from "@permanentorg/sdk";
import { generateFileEntriesForArchiveRecords } from "./generateFileEntriesForArchiveRecords";
import type { ArchiveRecord, File } from "@permanentorg/sdk";

describe("generateFileEntriesForArchiveRecords", () => {
	it("should return empty array for empty input", () => {
		const result = generateFileEntriesForArchiveRecords([]);
		expect(result).toEqual([]);
	});

	it("should generate file entries for archive records with original files", () => {
		const originalFile: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "application/pdf",
			updatedAt: new Date("2024-01-01T10:00:00Z")
		};

		const archiveRecord: Partial<ArchiveRecord> = {
			id: 123,
			fileSystemCompatibleName: "document.pdf",
			files: [originalFile as File]
		};

		const result = generateFileEntriesForArchiveRecords([archiveRecord as ArchiveRecord]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("document.pdf");
		expect(result[0].attrs.size).toBe(1024);
		expect(result[0].attrs.mtime).toBe(originalFile.updatedAt!.getTime() / 1000);
	});

	it("should skip archive records without original files", () => {
		const convertedFile: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Converted,
			size: 256,
			contentType: "image/jpeg",
			updatedAt: new Date()
		};

		const archiveRecordWithoutOriginal: Partial<ArchiveRecord> = {
			id: 123,
			fileSystemCompatibleName: "converted.jpg",
			files: [convertedFile as File]
		};

		const originalFile: Partial<File> = {
			id: 2,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "application/pdf",
			updatedAt: new Date("2024-01-01T10:00:00Z")
		};

		const validArchiveRecord: Partial<ArchiveRecord> = {
			id: 456,
			fileSystemCompatibleName: "document.pdf",
			files: [originalFile as File]
		};

		const result = generateFileEntriesForArchiveRecords([
			archiveRecordWithoutOriginal as ArchiveRecord,
			validArchiveRecord as ArchiveRecord
		]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("document.pdf");
	});

	it("should handle multiple valid archive records", () => {
		const file1: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "application/pdf",
			updatedAt: new Date("2024-01-01T10:00:00Z")
		};

		const file2: Partial<File> = {
			id: 2,
			derivativeType: DerivativeType.Original,
			size: 2048,
			contentType: "image/jpeg",
			updatedAt: new Date("2024-01-02T10:00:00Z")
		};

		const archiveRecords: Partial<ArchiveRecord>[] = [
			{
				id: 123,
				fileSystemCompatibleName: "document1.pdf",
				files: [file1 as File]
			},
			{
				id: 456,
				fileSystemCompatibleName: "document2.jpg",
				files: [file2 as File]
			}
		];

		const result = generateFileEntriesForArchiveRecords(archiveRecords as ArchiveRecord[]);

		expect(result).toHaveLength(2);
		expect(result[0].filename).toBe("document1.pdf");
		expect(result[0].attrs.size).toBe(1024);
		expect(result[1].filename).toBe("document2.jpg");
		expect(result[1].attrs.size).toBe(2048);
	});

	it("should handle mixed valid and invalid archive records", () => {
		const validFile: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "application/pdf",
			updatedAt: new Date("2024-01-01T10:00:00Z")
		};

		const archiveRecords: Partial<ArchiveRecord>[] = [
			{
				id: 123,
				fileSystemCompatibleName: "valid.pdf",
				files: [validFile as File]
			},
			{
				id: 456,
				fileSystemCompatibleName: "invalid.jpg",
				files: [] // No files
			},
			{
				id: 789,
				fileSystemCompatibleName: "also-invalid.doc",
				files: [{
					id: 2,
					derivativeType: DerivativeType.Converted,
					size: 256,
					contentType: "image/jpeg",
					updatedAt: new Date()
				} as File] // No original
			}
		];

		const result = generateFileEntriesForArchiveRecords(archiveRecords as ArchiveRecord[]);

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("valid.pdf");
	});

	it("should preserve order of valid archive records", () => {
		const createArchiveRecord = (id: number, name: string): ArchiveRecord => ({
			id,
			fileSystemCompatibleName: name,
			files: [{
				id,
				derivativeType: DerivativeType.Original,
				size: 1024,
				contentType: "application/pdf",
				updatedAt: new Date()
			} as File]
		} as ArchiveRecord);

		const archiveRecords = [
			createArchiveRecord(3, "third.pdf"),
			createArchiveRecord(1, "first.pdf"),
			createArchiveRecord(2, "second.pdf")
		];

		const result = generateFileEntriesForArchiveRecords(archiveRecords);

		expect(result).toHaveLength(3);
		expect(result[0].filename).toBe("third.pdf");
		expect(result[1].filename).toBe("first.pdf");
		expect(result[2].filename).toBe("second.pdf");
	});
});