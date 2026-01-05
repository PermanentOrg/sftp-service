import { MissingTemporaryFileError } from "../errors";
import {
	mockFs,
	mockFsAccessFailure,
	mockFsAccessSuccess,
	mockLogger,
	mockTmp,
	mockTmpFileFailure,
	mockTmpFileSuccess,
} from "../test/mocks";
import { TemporaryFileManager } from "./TemporaryFileManager";

jest.mock("fs");
jest.mock("tmp");
jest.mock("../logger", () => ({
	logger: mockLogger,
}));

describe("TemporaryFileManager", () => {
	let manager: TemporaryFileManager;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		manager = new TemporaryFileManager();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("createTemporaryFile", () => {
		it("should create a temporary file and return it", async () => {
			const mockRemoveCallback = mockTmpFileSuccess();

			const result = await manager.createTemporaryFile("/virtual/path.txt");

			expect(result.name).toBe("/tmp/test-file");
			expect(result.fd).toBe(123);
			expect(result.virtualPath).toBe("/virtual/path.txt");
			expect(result.removeCallback).toBe(mockRemoveCallback);
		});

		it("should store the temporary file for later retrieval", async () => {
			mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");
			const retrieved = await manager.getTemporaryFile("/virtual/path.txt");

			expect(retrieved.virtualPath).toBe("/virtual/path.txt");
		});

		it("should reject when tmp.file fails", async () => {
			mockTmpFileFailure(new Error("Failed to create temp file"));

			await expect(
				manager.createTemporaryFile("/virtual/path.txt"),
			).rejects.toThrow("Failed to create temp file");
		});
	});

	describe("getTemporaryFile", () => {
		it("should return the temporary file if it exists in memory and on disk", async () => {
			mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");
			const result = await manager.getTemporaryFile("/virtual/path.txt");

			expect(result.name).toBe("/tmp/test-file");
			expect(result.virtualPath).toBe("/virtual/path.txt");
		});

		it("should throw MissingTemporaryFileError if file not in memory", async () => {
			await expect(
				manager.getTemporaryFile("/nonexistent/path.txt"),
			).rejects.toThrow(MissingTemporaryFileError);
			await expect(
				manager.getTemporaryFile("/nonexistent/path.txt"),
			).rejects.toThrow(
				"Attempted to access a temporary file that does not exist in memory.",
			);
		});

		it("should throw MissingTemporaryFileError if file not on disk", async () => {
			mockTmpFileSuccess();
			mockFsAccessFailure();

			await manager.createTemporaryFile("/virtual/path.txt");

			await expect(
				manager.getTemporaryFile("/virtual/path.txt"),
			).rejects.toThrow(MissingTemporaryFileError);
			await expect(
				manager.getTemporaryFile("/virtual/path.txt"),
			).rejects.toThrow(
				"Attempted to access a temporary file that does not exist on disk.",
			);
		});
	});

	describe("deleteTemporaryFile", () => {
		it("should call removeCallback on the temporary file", async () => {
			const mockRemoveCallback = mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");
			await manager.deleteTemporaryFile("/virtual/path.txt");

			expect(mockRemoveCallback).toHaveBeenCalled();
		});

		it("should throw if file does not exist", async () => {
			await expect(
				manager.deleteTemporaryFile("/nonexistent/path.txt"),
			).rejects.toThrow(MissingTemporaryFileError);
		});
	});

	describe("cleanup timeout", () => {
		it("should set a cleanup timeout when creating a file", async () => {
			mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");

			expect(jest.getTimerCount()).toBe(1);
		});

		it("should delete the file after 24 hours", async () => {
			const mockRemoveCallback = mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");

			await jest.advanceTimersByTimeAsync(86400000);

			expect(mockRemoveCallback).toHaveBeenCalled();
		});

		it("should refresh the timeout when getting a file", async () => {
			const mockRemoveCallback = mockTmpFileSuccess();
			mockFsAccessSuccess();

			await manager.createTemporaryFile("/virtual/path.txt");

			// Advance 23 hours
			await jest.advanceTimersByTimeAsync(82800000);

			// Get the file, which should refresh the timeout
			await manager.getTemporaryFile("/virtual/path.txt");

			// Advance another 23 hours (46 hours total)
			await jest.advanceTimersByTimeAsync(82800000);

			// File should not be deleted yet because timeout was refreshed
			expect(mockRemoveCallback).not.toHaveBeenCalled();

			// Advance 1 more hour (24 hours since last access)
			await jest.advanceTimersByTimeAsync(3600000);

			expect(mockRemoveCallback).toHaveBeenCalled();
		});

		it("should clear the timeout when deleting a file", async () => {
			const mockRemoveCallback = jest.fn();
			let fileExists = true;
			mockTmp.file.mockImplementation((callback) => {
				callback(null, "/tmp/test-file", 123, mockRemoveCallback);
			});
			mockFs.access.mockImplementation((_path, callback) => {
				if (fileExists) {
					(callback as (err: NodeJS.ErrnoException | null) => void)(null);
				} else {
					const error = new Error("ENOENT") as NodeJS.ErrnoException;
					error.code = "ENOENT";
					(callback as (err: NodeJS.ErrnoException | null) => void)(error);
				}
			});
			mockRemoveCallback.mockImplementation(() => {
				fileExists = false;
			});

			await manager.createTemporaryFile("/virtual/path.txt");
			await manager.deleteTemporaryFile("/virtual/path.txt");

			// removeCallback called once during delete
			expect(mockRemoveCallback).toHaveBeenCalledTimes(1);

			// Advance past the timeout - the cleanup will try to delete again
			// but will fail because file no longer exists on disk
			await jest.advanceTimersByTimeAsync(86400000);

			// Should not be called again because file doesn't exist on disk
			expect(mockRemoveCallback).toHaveBeenCalledTimes(1);
		});
	});
});
