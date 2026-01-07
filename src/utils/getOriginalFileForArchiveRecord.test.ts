import { DerivativeType } from "@permanentorg/sdk";
import { createTestArchiveRecord, createTestFile } from "../test/factories";
import { getOriginalFileForArchiveRecord } from "./getOriginalFileForArchiveRecord";

describe("getOriginalFileForArchiveRecord", () => {
	test("should return the original file from the archive record", () => {
		const originalFile = createTestFile({
			id: 1,
			derivativeType: DerivativeType.Original,
		});
		const archiveRecord = createTestArchiveRecord({
			files: [originalFile],
		});

		const result = getOriginalFileForArchiveRecord(archiveRecord);

		expect(result).toBe(originalFile);
	});

	test("should find the original file among multiple files", () => {
		const convertedFile = createTestFile({
			id: 1,
			derivativeType: DerivativeType.Converted,
		});
		const originalFile = createTestFile({
			id: 2,
			derivativeType: DerivativeType.Original,
		});
		const fullHdFile = createTestFile({
			id: 3,
			derivativeType: DerivativeType.FullHd,
		});
		const archiveRecord = createTestArchiveRecord({
			files: [convertedFile, originalFile, fullHdFile],
		});

		const result = getOriginalFileForArchiveRecord(archiveRecord);

		expect(result).toBe(originalFile);
	});

	test("should return the first original file when multiple exist", () => {
		const firstOriginal = createTestFile({
			id: 1,
			derivativeType: DerivativeType.Original,
		});
		const secondOriginal = createTestFile({
			id: 2,
			derivativeType: DerivativeType.Original,
		});
		const archiveRecord = createTestArchiveRecord({
			files: [firstOriginal, secondOriginal],
		});

		const result = getOriginalFileForArchiveRecord(archiveRecord);

		expect(result).toBe(firstOriginal);
	});

	test("should throw an error when no original file exists", () => {
		const convertedFile = createTestFile({
			derivativeType: DerivativeType.Converted,
		});
		const archiveRecord = createTestArchiveRecord({
			id: 42,
			files: [convertedFile],
		});

		expect(() => getOriginalFileForArchiveRecord(archiveRecord)).toThrow(
			"Permanent does not have an original file for Archive Record 42",
		);
	});

	test("should throw an error when files array is empty", () => {
		const archiveRecord = createTestArchiveRecord({
			id: 99,
			files: [],
		});

		expect(() => getOriginalFileForArchiveRecord(archiveRecord)).toThrow(
			"Permanent does not have an original file for Archive Record 99",
		);
	});
});
