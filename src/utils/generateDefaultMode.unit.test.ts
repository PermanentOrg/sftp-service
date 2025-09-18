import fs from "fs";
import { generateDefaultMode } from "./generateDefaultMode";

describe("generateDefaultMode", () => {
	it("should generate mode for regular file", () => {
		const baseType = fs.constants.S_IFREG;
		const result = generateDefaultMode(baseType);

		expect(result & fs.constants.S_IFMT).toBe(fs.constants.S_IFREG);
		expect(result & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should generate mode for directory", () => {
		const baseType = fs.constants.S_IFDIR;
		const result = generateDefaultMode(baseType);

		expect(result & fs.constants.S_IFMT).toBe(fs.constants.S_IFDIR);
		expect(result & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should generate mode for symbolic link", () => {
		const baseType = fs.constants.S_IFLNK;
		const result = generateDefaultMode(baseType);

		expect(result & fs.constants.S_IFMT).toBe(fs.constants.S_IFLNK);
		expect(result & fs.constants.S_IRWXU).toBe(fs.constants.S_IRWXU);
		expect(result & fs.constants.S_IRWXG).toBe(fs.constants.S_IRWXG);
		expect(result & fs.constants.S_IRWXO).toBe(fs.constants.S_IRWXO);
	});

	it("should include all permission bits", () => {
		const baseType = fs.constants.S_IFREG;
		const result = generateDefaultMode(baseType);

		expect(result & fs.constants.S_IRUSR).toBe(fs.constants.S_IRUSR);
		expect(result & fs.constants.S_IWUSR).toBe(fs.constants.S_IWUSR);
		expect(result & fs.constants.S_IXUSR).toBe(fs.constants.S_IXUSR);

		expect(result & fs.constants.S_IRGRP).toBe(fs.constants.S_IRGRP);
		expect(result & fs.constants.S_IWGRP).toBe(fs.constants.S_IWGRP);
		expect(result & fs.constants.S_IXGRP).toBe(fs.constants.S_IXGRP);

		expect(result & fs.constants.S_IROTH).toBe(fs.constants.S_IROTH);
		expect(result & fs.constants.S_IWOTH).toBe(fs.constants.S_IWOTH);
		expect(result & fs.constants.S_IXOTH).toBe(fs.constants.S_IXOTH);
	});

	it("should preserve base type when adding permissions", () => {
		const baseTypes = [
			fs.constants.S_IFREG,
			fs.constants.S_IFDIR,
			fs.constants.S_IFLNK,
			fs.constants.S_IFBLK,
			fs.constants.S_IFCHR,
			fs.constants.S_IFIFO
		];

		baseTypes.forEach(baseType => {
			const result = generateDefaultMode(baseType);
			expect(result & fs.constants.S_IFMT).toBe(baseType);
		});
	});
});