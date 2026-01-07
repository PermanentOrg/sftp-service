import { createTestFolder, DIRECTORY_MODE } from "../test/factories";
import { generateAttributesForFolder } from "./generateAttributesForFolder";

describe("generateAttributesForFolder", () => {
	test("should set mode to directory with full permissions", () => {
		const folder = createTestFolder();

		const result = generateAttributesForFolder(folder);

		expect(result.mode).toBe(DIRECTORY_MODE);
	});

	test("should use the folder size", () => {
		const folder = createTestFolder({ size: 8192 });

		const result = generateAttributesForFolder(folder);

		expect(result.size).toBe(8192);
	});

	test("should convert updatedAt to unix timestamp for mtime", () => {
		const updatedAt = new Date("2024-06-15T10:30:00Z");
		const folder = createTestFolder({ updatedAt });

		const result = generateAttributesForFolder(folder);

		expect(result.mtime).toBe(updatedAt.getTime() / 1000);
	});

	test("should set atime to 0", () => {
		const folder = createTestFolder();

		const result = generateAttributesForFolder(folder);

		expect(result.atime).toBe(0);
	});

	test("should set uid and gid to 0", () => {
		const folder = createTestFolder();

		const result = generateAttributesForFolder(folder);

		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
	});
});
