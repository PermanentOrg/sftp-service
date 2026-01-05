import fs from "fs";
import { DIRECTORY_MODE, FILE_MODE } from "../test/factories";
import { generateDefaultMode } from "./generateDefaultMode";

describe("generateDefaultMode", () => {
	test("should add full permissions to a regular file type", () => {
		const result = generateDefaultMode(fs.constants.S_IFREG);

		expect(result).toBe(FILE_MODE);
	});

	test("should add full permissions to a directory type", () => {
		const result = generateDefaultMode(fs.constants.S_IFDIR);

		expect(result).toBe(DIRECTORY_MODE);
	});

	test("should include read, write, execute for user", () => {
		const result = generateDefaultMode(fs.constants.S_IFREG);

		expect(result & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
	});

	test("should include read, write, execute for group", () => {
		const result = generateDefaultMode(fs.constants.S_IFREG);

		expect(result & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
	});

	test("should include read, write, execute for other", () => {
		const result = generateDefaultMode(fs.constants.S_IFREG);

		expect(result & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	test("should preserve the base type in the result", () => {
		const fileResult = generateDefaultMode(fs.constants.S_IFREG);
		const dirResult = generateDefaultMode(fs.constants.S_IFDIR);

		expect(fileResult & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(dirResult & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
	});
});
