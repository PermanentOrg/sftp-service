import { FileSystemObjectNotFound } from "./FileSystemObjectNotFound";

describe("FileSystemObjectNotFound", () => {
	it("should be an instance of Error", () => {
		const error = new FileSystemObjectNotFound("Test message");
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(FileSystemObjectNotFound);
	});

	it("should preserve error message", () => {
		const message = "File not found at /path/to/file";
		const error = new FileSystemObjectNotFound(message);
		expect(error.message).toBe(message);
	});

	it("should have correct name property", () => {
		const error = new FileSystemObjectNotFound("Test");
		expect(error.name).toBe("Error");
	});

	it("should be throwable and catchable", () => {
		const message = "Test error message";

		expect(() => {
			throw new FileSystemObjectNotFound(message);
		}).toThrow(FileSystemObjectNotFound);

		expect(() => {
			throw new FileSystemObjectNotFound(message);
		}).toThrow(message);
	});

	it("should work in try-catch blocks", () => {
		const message = "Specific error message";
		let caughtError: Error | null = null;

		try {
			throw new FileSystemObjectNotFound(message);
		} catch (error) {
			caughtError = error as Error;
		}

		expect(caughtError).toBeInstanceOf(FileSystemObjectNotFound);
		expect(caughtError?.message).toBe(message);
	});

	it("should work without message", () => {
		const error = new FileSystemObjectNotFound();
		expect(error).toBeInstanceOf(FileSystemObjectNotFound);
		expect(error.message).toBe("");
	});
});