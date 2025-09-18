import { DerivativeType } from "@permanentorg/sdk";
import { getOriginalFileForArchiveRecord } from "./getOriginalFileForArchiveRecord";
import type { File, ArchiveRecord } from "@permanentorg/sdk";

describe("getOriginalFileForArchiveRecord", () => {
	it("should return original file when present", () => {
		const originalFile: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "image/jpeg",
			updatedAt: new Date()
		};

		const convertedFile: Partial<File> = {
			id: 2,
			derivativeType: DerivativeType.Converted,
			size: 256,
			contentType: "image/jpeg",
			updatedAt: new Date()
		};

		const archiveRecord: Partial<ArchiveRecord> = {
			id: 123,
			files: [convertedFile as File, originalFile as File]
		};

		const result = getOriginalFileForArchiveRecord(archiveRecord as ArchiveRecord);

		expect(result).toBe(originalFile);
		expect(result.derivativeType).toBe(DerivativeType.Original);
	});

	it("should throw error when no original file exists", () => {
		const convertedFile: Partial<File> = {
			id: 2,
			derivativeType: DerivativeType.Converted,
			size: 256,
			contentType: "image/jpeg",
			updatedAt: new Date()
		};

		const fullHdFile: Partial<File> = {
			id: 3,
			derivativeType: DerivativeType.FullHd,
			size: 512,
			contentType: "video/mp4",
			updatedAt: new Date()
		};

		const archiveRecord: Partial<ArchiveRecord> = {
			id: 123,
			files: [convertedFile as File, fullHdFile as File]
		};

		expect(() => getOriginalFileForArchiveRecord(archiveRecord as ArchiveRecord)).toThrow(
			"Permanent does not have an original file for Archive Record 123"
		);
	});

	it("should throw error when files array is empty", () => {
		const archiveRecord: Partial<ArchiveRecord> = {
			id: 456,
			files: []
		};

		expect(() => getOriginalFileForArchiveRecord(archiveRecord as ArchiveRecord)).toThrow(
			"Permanent does not have an original file for Archive Record 456"
		);
	});

	it("should find original file among multiple files", () => {
		const files: Partial<File>[] = [
			{ id: 1, derivativeType: DerivativeType.Converted, size: 100, contentType: "image/jpeg", updatedAt: new Date() },
			{ id: 2, derivativeType: DerivativeType.FullHd, size: 200, contentType: "video/mp4", updatedAt: new Date() },
			{ id: 3, derivativeType: DerivativeType.Original, size: 300, contentType: "application/pdf", updatedAt: new Date() },
			{ id: 4, derivativeType: DerivativeType.Unknown, size: 400, contentType: "unknown", updatedAt: new Date() }
		];

		const archiveRecord: Partial<ArchiveRecord> = {
			id: 789,
			files: files as File[]
		};

		const result = getOriginalFileForArchiveRecord(archiveRecord as ArchiveRecord);

		expect(result.id).toBe(3);
		expect(result.derivativeType).toBe(DerivativeType.Original);
		expect(result.contentType).toBe("application/pdf");
	});

	it("should return first original file if multiple exist", () => {
		const firstOriginal: Partial<File> = {
			id: 1,
			derivativeType: DerivativeType.Original,
			size: 1024,
			contentType: "image/jpeg",
			updatedAt: new Date()
		};

		const secondOriginal: Partial<File> = {
			id: 2,
			derivativeType: DerivativeType.Original,
			size: 2048,
			contentType: "image/png",
			updatedAt: new Date()
		};

		const archiveRecord: Partial<ArchiveRecord> = {
			id: 999,
			files: [firstOriginal as File, secondOriginal as File]
		};

		const result = getOriginalFileForArchiveRecord(archiveRecord as ArchiveRecord);

		expect(result).toBe(firstOriginal);
		expect(result.contentType).toBe("image/jpeg");
	});
});