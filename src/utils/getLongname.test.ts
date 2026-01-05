import {
	createTestAttributes,
	DIRECTORY_MODE,
	FILE_MODE,
} from "../test/factories";
import { getLongname } from "./getLongname";

describe("getLongname", () => {
	describe("when given a regular file", () => {
		it("should return a longname starting with '-'", () => {
			const result = getLongname("test.txt", createTestAttributes());
			expect(result).toBe("-rwxrwxrwx 1 nobody nogroup test.txt");
		});
	});

	describe("when given a directory", () => {
		it("should return a longname starting with 'd'", () => {
			const result = getLongname(
				"my-folder",
				createTestAttributes({ mode: DIRECTORY_MODE }),
			);
			expect(result).toBe("drwxrwxrwx 1 nobody nogroup my-folder");
		});
	});

	describe("when given custom owner and group", () => {
		it("should use the provided owner and group", () => {
			const result = getLongname(
				"file.txt",
				createTestAttributes({ mode: FILE_MODE }),
				"alice",
				"staff",
			);
			expect(result).toBe("-rwxrwxrwx 1 alice staff file.txt");
		});
	});

	describe("when given only a custom owner", () => {
		it("should use the provided owner and default group", () => {
			const result = getLongname(
				"file.txt",
				createTestAttributes({ mode: FILE_MODE }),
				"bob",
			);
			expect(result).toBe("-rwxrwxrwx 1 bob nogroup file.txt");
		});
	});

	describe("when given a filename with spaces", () => {
		it("should preserve the spaces in the output", () => {
			const result = getLongname(
				"my file.txt",
				createTestAttributes({ mode: FILE_MODE }),
			);
			expect(result).toBe("-rwxrwxrwx 1 nobody nogroup my file.txt");
		});
	});
});
