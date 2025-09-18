import { getArchiveSlugFromPath } from "./getArchiveSlugFromPath";

describe("getArchiveSlugFromPath", () => {
	it("should extract archive slug from simple archive path", () => {
		const path = "/archives/My Archive (archive-123)";
		const result = getArchiveSlugFromPath(path);
		expect(result).toBe("archive-123");
	});

	it("should extract archive slug from nested archive path", () => {
		const path = "/archives/My Archive (archive-456)/subfolder/file.txt";
		const result = getArchiveSlugFromPath(path);
		expect(result).toBe("archive-456");
	});

	it("should handle archive names with special characters", () => {
		const path = "/archives/My Archive & More! (archive-789)/nested/path";
		const result = getArchiveSlugFromPath(path);
		expect(result).toBe("archive-789");
	});

	it("should handle archive slug with hyphens and numbers", () => {
		const path = "/archives/Test Archive (test-archive-001)";
		const result = getArchiveSlugFromPath(path);
		expect(result).toBe("test-archive-001");
	});

	it("should handle deeply nested paths", () => {
		const path = "/archives/Archive Name (slug-123)/folder1/folder2/folder3/file.ext";
		const result = getArchiveSlugFromPath(path);
		expect(result).toBe("slug-123");
	});

	it("should throw error for invalid path format", () => {
		const invalidPath = "/invalid/path/format";
		expect(() => getArchiveSlugFromPath(invalidPath)).toThrow(
			"The specified path did not contain an archive slug"
		);
	});

	it("should throw error for missing parentheses", () => {
		const invalidPath = "/archives/My Archive";
		expect(() => getArchiveSlugFromPath(invalidPath)).toThrow(
			"The specified path did not contain an archive slug"
		);
	});

	it("should throw error for empty parentheses", () => {
		const invalidPath = "/archives/My Archive ()";
		expect(() => getArchiveSlugFromPath(invalidPath)).toThrow(
			"The specified path did not contain an archive slug"
		);
	});

	it("should throw error for malformed archive path", () => {
		const invalidPath = "/archives/My Archive (incomplete";
		expect(() => getArchiveSlugFromPath(invalidPath)).toThrow(
			"The specified path did not contain an archive slug"
		);
	});
});