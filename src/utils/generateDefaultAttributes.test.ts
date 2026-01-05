import fs from "fs";
import { DIRECTORY_MODE, FILE_MODE } from "../test/factories";
import { generateDefaultAttributes } from "./generateDefaultAttributes";

describe("generateDefaultAttributes", () => {
	test("should set mode using generateDefaultMode for regular file", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.mode).toBe(FILE_MODE);
	});

	test("should set mode using generateDefaultMode for directory", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFDIR);

		expect(result.mode).toBe(DIRECTORY_MODE);
	});

	test("should set uid to 0", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.uid).toBe(0);
	});

	test("should set gid to 0", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.gid).toBe(0);
	});

	test("should set size to 0", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.size).toBe(0);
	});

	test("should set atime to 0", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.atime).toBe(0);
	});

	test("should set mtime to 0", () => {
		const result = generateDefaultAttributes(fs.constants.S_IFREG);

		expect(result.mtime).toBe(0);
	});
});
