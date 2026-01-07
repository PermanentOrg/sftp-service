import { getArchiveSlugFromPath } from "./getArchiveSlugFromPath";

describe("getArchiveSlugFromPath", () => {
	test("extracts slug from basic archive path", () => {
		const path = "/archives/My Archive (abc-123)";
		expect(getArchiveSlugFromPath(path)).toBe("abc-123");
	});

	test("extracts slug from path with subfolder", () => {
		const path = "/archives/My Archive (abc-123)/subfolder";
		expect(getArchiveSlugFromPath(path)).toBe("abc-123");
	});

	test("extracts slug from path with deep nesting", () => {
		const path = "/archives/My Archive (abc-123)/a/b/c";
		expect(getArchiveSlugFromPath(path)).toBe("abc-123");
	});

	test("handles archive names with parentheses", () => {
		const path = "/archives/My (Cool) Archive (xyz-789)";
		expect(getArchiveSlugFromPath(path)).toBe("xyz-789");
	});

	test("handles slugs with only letters", () => {
		const path = "/archives/Test Archive (abcdef)";
		expect(getArchiveSlugFromPath(path)).toBe("abcdef");
	});

	test("handles slugs with only numbers", () => {
		const path = "/archives/Test Archive (123456)";
		expect(getArchiveSlugFromPath(path)).toBe("123456");
	});

	test("throws error for path without archive section", () => {
		const path = "/some/other/path";
		expect(() => getArchiveSlugFromPath(path)).toThrow(
			"The specified path did not contain an archive slug",
		);
	});

	test("throws error for path with missing slug parentheses", () => {
		const path = "/archives/My Archive";
		expect(() => getArchiveSlugFromPath(path)).toThrow(
			"The specified path did not contain an archive slug",
		);
	});

	test("throws error for empty string", () => {
		expect(() => getArchiveSlugFromPath("")).toThrow(
			"The specified path did not contain an archive slug",
		);
	});

	test("throws error for root archives path", () => {
		const path = "/archives";
		expect(() => getArchiveSlugFromPath(path)).toThrow(
			"The specified path did not contain an archive slug",
		);
	});

	test("throws error for path without space before parentheses", () => {
		const path = "/archives/MyArchive(abc-123)";
		expect(() => getArchiveSlugFromPath(path)).toThrow(
			"The specified path did not contain an archive slug",
		);
	});
});
