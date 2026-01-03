import fs from "fs";
import { getLongname } from "./getLongname";
import type { Attributes } from "ssh2";

const FILE_MODE =
	fs.constants.S_IFREG |
	fs.constants.S_IRWXU |
	fs.constants.S_IRWXG |
	fs.constants.S_IRWXO;

const DIRECTORY_MODE =
	fs.constants.S_IFDIR |
	fs.constants.S_IRWXU |
	fs.constants.S_IRWXG |
	fs.constants.S_IRWXO;

describe("getLongname", () => {
	describe("when given a regular file", () => {
		it("should return a longname starting with '-'", () => {
			const attributes: Attributes = {
				mode: FILE_MODE,
			};
			const result = getLongname("test.txt", attributes);
			expect(result).toBe("-rwxrwxrwx 1 nobody nogroup test.txt");
		});
	});

	describe("when given a directory", () => {
		it("should return a longname starting with 'd'", () => {
			const attributes: Attributes = {
				mode: DIRECTORY_MODE,
			};
			const result = getLongname("my-folder", attributes);
			expect(result).toBe("drwxrwxrwx 1 nobody nogroup my-folder");
		});
	});

	describe("when given custom owner and group", () => {
		it("should use the provided owner and group", () => {
			const attributes: Attributes = {
				mode: FILE_MODE,
			};
			const result = getLongname("file.txt", attributes, "alice", "staff");
			expect(result).toBe("-rwxrwxrwx 1 alice staff file.txt");
		});
	});

	describe("when given only a custom owner", () => {
		it("should use the provided owner and default group", () => {
			const attributes: Attributes = {
				mode: FILE_MODE,
			};
			const result = getLongname("file.txt", attributes, "bob");
			expect(result).toBe("-rwxrwxrwx 1 bob nogroup file.txt");
		});
	});

	describe("when given a filename with spaces", () => {
		it("should preserve the spaces in the output", () => {
			const attributes: Attributes = {
				mode: FILE_MODE,
			};
			const result = getLongname("my file.txt", attributes);
			expect(result).toBe("-rwxrwxrwx 1 nobody nogroup my file.txt");
		});
	});
});
