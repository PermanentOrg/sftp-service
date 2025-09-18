import fs from "fs";
import { generateDefaultAttributes } from "./generateDefaultAttributes";

describe("generateDefaultAttributes", () => {
	it("should generate default attributes for regular file", () => {
		const fileType = fs.constants.S_IFREG;
		const result = generateDefaultAttributes(fileType);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	it("should generate default attributes for directory", () => {
		const fileType = fs.constants.S_IFDIR;
		const result = generateDefaultAttributes(fileType);

		expect(result.mode & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result.uid).toBe(0);
		expect(result.gid).toBe(0);
		expect(result.size).toBe(0);
		expect(result.atime).toBe(0);
		expect(result.mtime).toBe(0);
	});

	it("should include all permission bits in mode", () => {
		const fileType = fs.constants.S_IFREG;
		const result = generateDefaultAttributes(fileType);

		expect(result.mode & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result.mode & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result.mode & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should have consistent structure across different file types", () => {
		const fileTypes = [fs.constants.S_IFREG, fs.constants.S_IFDIR, fs.constants.S_IFLNK];

		fileTypes.forEach(fileType => {
			const result = generateDefaultAttributes(fileType);

			expect(typeof result.mode).toBe("number");
			expect(typeof result.uid).toBe("number");
			expect(typeof result.gid).toBe("number");
			expect(typeof result.size).toBe("number");
			expect(typeof result.atime).toBe("number");
			expect(typeof result.mtime).toBe("number");

			expect(result.uid).toBe(0);
			expect(result.gid).toBe(0);
			expect(result.size).toBe(0);
			expect(result.atime).toBe(0);
			expect(result.mtime).toBe(0);
		});
	});
});