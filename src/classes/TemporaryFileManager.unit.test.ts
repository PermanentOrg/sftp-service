import fs from "fs";
import tmp from "tmp";
import { TemporaryFileManager } from "./TemporaryFileManager";
import { MissingTemporaryFileError } from "../errors";

jest.mock("fs");
jest.mock("tmp");
jest.mock("../logger");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockTmp = tmp as jest.Mocked<typeof tmp>;

describe("TemporaryFileManager", () => {
	let manager: TemporaryFileManager;

	beforeEach(() => {
		manager = new TemporaryFileManager();
		jest.clearAllMocks();
		jest.clearAllTimers();
		jest.useFakeTimers();
		jest.spyOn(global, 'setTimeout');
		jest.spyOn(global, 'clearTimeout');
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("createTemporaryFile", () => {
		it("should create a temporary file successfully", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			const result = await manager.createTemporaryFile("/virtual/path");

			expect(result.name).toBe("/tmp/test-file");
			expect(result.fd).toBe(3);
			expect(result.virtualPath).toBe("/virtual/path");
			expect(result.removeCallback).toBe(mockFileData.removeCallback);
		});

		it("should reject when tmp.file fails", async () => {
			const error = new Error("Failed to create temporary file");
			mockTmp.file.mockImplementation((callback) => {
				callback(error, "", 0, jest.fn());
			});

			await expect(manager.createTemporaryFile("/virtual/path")).rejects.toThrow(error);
		});

		it("should set cleanup timeout when creating file", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			await manager.createTemporaryFile("/virtual/path");

			expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 86400000);
		});
	});

	describe("getTemporaryFile", () => {
		it("should return existing temporary file", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				(callback as (err: NodeJS.ErrnoException | null) => void)(null);
			});

			const createdFile = await manager.createTemporaryFile("/virtual/path");
			const retrievedFile = await manager.getTemporaryFile("/virtual/path");

			expect(retrievedFile).toEqual(createdFile);
		});

		it("should throw error for non-existent temporary file", async () => {
			await expect(manager.getTemporaryFile("/nonexistent")).rejects.toThrow(
				MissingTemporaryFileError
			);
			await expect(manager.getTemporaryFile("/nonexistent")).rejects.toThrow(
				"Attempted to access a temporary file that does not exist in memory."
			);
		});

		it("should throw error when file doesn't exist on disk", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				const error = new Error("ENOENT") as NodeJS.ErrnoException;
				error.code = "ENOENT";
				(callback as (err: NodeJS.ErrnoException | null) => void)(error);
			});

			await manager.createTemporaryFile("/virtual/path");

			await expect(manager.getTemporaryFile("/virtual/path")).rejects.toThrow(
				MissingTemporaryFileError
			);
			await expect(manager.getTemporaryFile("/virtual/path")).rejects.toThrow(
				"Attempted to access a temporary file that does not exist on disk."
			);
		});

		it("should refresh cleanup timeout when accessing file", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				(callback as (err: NodeJS.ErrnoException | null) => void)(null);
			});

			await manager.createTemporaryFile("/virtual/path");

			await manager.getTemporaryFile("/virtual/path");

			expect(global.clearTimeout).toHaveBeenCalled();
			expect(global.setTimeout).toHaveBeenCalledTimes(2); // Once for create, once for refresh
		});
	});

	describe("deleteTemporaryFile", () => {
		it("should delete temporary file successfully", async () => {
			const removeCallback = jest.fn();
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				(callback as (err: NodeJS.ErrnoException | null) => void)(null);
			});

			await manager.createTemporaryFile("/virtual/path");
			await manager.deleteTemporaryFile("/virtual/path");

			expect(removeCallback).toHaveBeenCalled();
		});

		it("should clear cleanup timeout when deleting", async () => {
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback: jest.fn()
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				(callback as (err: NodeJS.ErrnoException | null) => void)(null);
			});

			await manager.createTemporaryFile("/virtual/path");
			await manager.deleteTemporaryFile("/virtual/path");

			expect(global.clearTimeout).toHaveBeenCalled();
		});
	});

	describe("cleanup timeout", () => {
		it("should automatically delete file after 24 hours", async () => {
			const removeCallback = jest.fn();
			const mockFileData = {
				name: "/tmp/test-file",
				fd: 3,
				removeCallback
			};

			mockTmp.file.mockImplementation((callback) => {
				callback(null, mockFileData.name, mockFileData.fd, mockFileData.removeCallback);
			});

			mockFs.access.mockImplementation((_path, callback) => {
				(callback as (err: NodeJS.ErrnoException | null) => void)(null);
			});

			await manager.createTemporaryFile("/virtual/path");

			expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 86400000);

			// Get the timeout function that was registered
			const timeoutCall = (global.setTimeout as jest.Mock).mock.calls.find(
				call => call[1] === 86400000
			);
			const timeoutFunction = timeoutCall?.[0];

			// Execute the timeout function directly
			if (timeoutFunction) {
				await timeoutFunction();
			}

			expect(removeCallback).toHaveBeenCalled();
		});
	});
});