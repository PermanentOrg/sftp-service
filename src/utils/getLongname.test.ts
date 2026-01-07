import {
	createTestAttributes,
	DIRECTORY_MODE,
	FILE_MODE,
} from "../test/factories";
import { getLongname } from "./getLongname";

describe("getLongname", () => {
	test("should return a longname starting with '-' for a regular file", () => {
		const result = getLongname("test.txt", createTestAttributes());
		expect(result).toBe("-rwxrwxrwx 1 nobody nogroup test.txt");
	});

	test("should return a longname starting with 'd' for a directory", () => {
		const result = getLongname(
			"my-folder",
			createTestAttributes({ mode: DIRECTORY_MODE }),
		);
		expect(result).toBe("drwxrwxrwx 1 nobody nogroup my-folder");
	});

	test("should use the provided owner and group", () => {
		const result = getLongname(
			"file.txt",
			createTestAttributes({ mode: FILE_MODE }),
			"alice",
			"staff",
		);
		expect(result).toBe("-rwxrwxrwx 1 alice staff file.txt");
	});

	test("should use the provided owner and default group when only owner is given", () => {
		const result = getLongname(
			"file.txt",
			createTestAttributes({ mode: FILE_MODE }),
			"bob",
		);
		expect(result).toBe("-rwxrwxrwx 1 bob nogroup file.txt");
	});

	test("should preserve spaces in filenames", () => {
		const result = getLongname(
			"my file.txt",
			createTestAttributes({ mode: FILE_MODE }),
		);
		expect(result).toBe("-rwxrwxrwx 1 nobody nogroup my file.txt");
	});
});
