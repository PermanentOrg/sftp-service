import { getArchiveSlugFromPath } from "./getArchiveSlugFromPath";

describe("getArchiveSlugFromPath", () => {
	describe("valid paths", () => {
		it("extracts slug from basic archive path", () => {
			const path = "/archives/My Archive (abc-123)";
			expect(getArchiveSlugFromPath(path)).toBe("abc-123");
		});

		it("extracts slug from path with subfolder", () => {
			const path = "/archives/My Archive (abc-123)/subfolder";
			expect(getArchiveSlugFromPath(path)).toBe("abc-123");
		});

		it("extracts slug from path with deep nesting", () => {
			const path = "/archives/My Archive (abc-123)/a/b/c";
			expect(getArchiveSlugFromPath(path)).toBe("abc-123");
		});

		it("handles archive names with parentheses", () => {
			const path = "/archives/My (Cool) Archive (xyz-789)";
			expect(getArchiveSlugFromPath(path)).toBe("xyz-789");
		});

		it("handles slugs with only letters", () => {
			const path = "/archives/Test Archive (abcdef)";
			expect(getArchiveSlugFromPath(path)).toBe("abcdef");
		});

		it("handles slugs with only numbers", () => {
			const path = "/archives/Test Archive (123456)";
			expect(getArchiveSlugFromPath(path)).toBe("123456");
		});
	});

	describe("invalid paths", () => {
		it("throws error for path without archive section", () => {
			const path = "/some/other/path";
			expect(() => getArchiveSlugFromPath(path)).toThrow(
				"The specified path did not contain an archive slug",
			);
		});

		it("throws error for path with missing slug parentheses", () => {
			const path = "/archives/My Archive";
			expect(() => getArchiveSlugFromPath(path)).toThrow(
				"The specified path did not contain an archive slug",
			);
		});

		it("throws error for empty string", () => {
			expect(() => getArchiveSlugFromPath("")).toThrow(
				"The specified path did not contain an archive slug",
			);
		});

		it("throws error for root archives path", () => {
			const path = "/archives";
			expect(() => getArchiveSlugFromPath(path)).toThrow(
				"The specified path did not contain an archive slug",
			);
		});

		it("throws error for path without space before parentheses", () => {
			const path = "/archives/MyArchive(abc-123)";
			expect(() => getArchiveSlugFromPath(path)).toThrow(
				"The specified path did not contain an archive slug",
			);
		});
	});
});
