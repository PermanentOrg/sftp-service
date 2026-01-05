import { createTestFileEntry } from "../test/factories";
import { deduplicateFileEntries } from "./deduplicateFileEntries";

describe("deduplicateFileEntries", () => {
	describe("when given an empty array", () => {
		it("should return an empty array", () => {
			const result = deduplicateFileEntries([]);
			expect(result).toEqual([]);
		});
	});

	describe("when given entries with unique filenames", () => {
		it("should return all entries for a single entry", () => {
			const entries = [createTestFileEntry({ filename: "file1.txt" })];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(1);
			expect(result[0].filename).toBe("file1.txt");
		});

		it("should return all entries when all are unique", () => {
			const entries = [
				createTestFileEntry({ filename: "file1.txt" }),
				createTestFileEntry({ filename: "file2.txt" }),
				createTestFileEntry({ filename: "file3.txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(3);
			expect(result.map((e) => e.filename)).toEqual([
				"file1.txt",
				"file2.txt",
				"file3.txt",
			]);
		});
	});

	describe("when given entries with duplicate filenames", () => {
		it("should keep only the first occurrence of a duplicate", () => {
			const first = createTestFileEntry({ filename: "file.txt" });
			const duplicate = createTestFileEntry({ filename: "file.txt" });
			const entries = [first, duplicate];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(1);
			expect(result[0]).toBe(first);
		});

		it("should remove multiple duplicates of the same filename", () => {
			const entries = [
				createTestFileEntry({ filename: "file.txt" }),
				createTestFileEntry({ filename: "file.txt" }),
				createTestFileEntry({ filename: "file.txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(1);
			expect(result[0].filename).toBe("file.txt");
		});

		it("should handle mixed unique and duplicate entries", () => {
			const entries = [
				createTestFileEntry({ filename: "file1.txt" }),
				createTestFileEntry({ filename: "file2.txt" }),
				createTestFileEntry({ filename: "file1.txt" }),
				createTestFileEntry({ filename: "file3.txt" }),
				createTestFileEntry({ filename: "file2.txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(3);
			expect(result.map((e) => e.filename)).toEqual([
				"file1.txt",
				"file2.txt",
				"file3.txt",
			]);
		});

		it("should preserve original order of first occurrences", () => {
			const entries = [
				createTestFileEntry({ filename: "zebra.txt" }),
				createTestFileEntry({ filename: "apple.txt" }),
				createTestFileEntry({ filename: "zebra.txt" }),
				createTestFileEntry({ filename: "mango.txt" }),
				createTestFileEntry({ filename: "apple.txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result.map((e) => e.filename)).toEqual([
				"zebra.txt",
				"apple.txt",
				"mango.txt",
			]);
		});
	});

	describe("edge cases", () => {
		it("should treat filenames as case-sensitive", () => {
			const entries = [
				createTestFileEntry({ filename: "File.txt" }),
				createTestFileEntry({ filename: "file.txt" }),
				createTestFileEntry({ filename: "FILE.txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(3);
		});

		it("should handle filenames with special characters", () => {
			const entries = [
				createTestFileEntry({ filename: "file (1).txt" }),
				createTestFileEntry({ filename: "file (1).txt" }),
				createTestFileEntry({ filename: "file (2).txt" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(2);
			expect(result.map((e) => e.filename)).toEqual([
				"file (1).txt",
				"file (2).txt",
			]);
		});

		it("should handle empty string filenames", () => {
			const entries = [
				createTestFileEntry({ filename: "" }),
				createTestFileEntry({ filename: "" }),
			];

			const result = deduplicateFileEntries(entries);

			expect(result).toHaveLength(1);
			expect(result[0].filename).toBe("");
		});
	});
});
