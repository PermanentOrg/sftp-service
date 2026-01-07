import { createTestArchive, DIRECTORY_MODE } from "../test/factories";
import { generateAttributesForArchive } from "./generateAttributesForArchive";

describe("generateAttributesForArchive", () => {
	test("should set mode to directory with full permissions", () => {
		const archive = createTestArchive();

		const result = generateAttributesForArchive(archive);

		expect(result.mode).toBe(DIRECTORY_MODE);
	});

	test("should set size to 0", () => {
		const archive = createTestArchive();

		const result = generateAttributesForArchive(archive);

		expect(result.size).toBe(0);
	});

	test("should convert updatedAt to unix timestamp for mtime", () => {
		const updatedAt = new Date("2024-06-15T10:30:00Z");
		const archive = createTestArchive({ updatedAt });

		const result = generateAttributesForArchive(archive);

		expect(result.mtime).toBe(updatedAt.getTime() / 1000);
	});

	test("should set atime to 0", () => {
		const archive = createTestArchive();

		const result = generateAttributesForArchive(archive);

		expect(result.atime).toBe(0);
	});

	test("should set uid and gid to 0", () => {
		const archive = createTestArchive();

		const result = generateAttributesForArchive(archive);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});
});
