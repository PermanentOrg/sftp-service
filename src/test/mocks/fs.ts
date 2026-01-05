import fs from "fs";

export const mockFs = jest.mocked(fs);

export const mockFsAccessSuccess = (): void => {
	mockFs.access.mockImplementation((_path, callback) => {
		(callback as (err: NodeJS.ErrnoException | null) => void)(null);
	});
};

export const mockFsAccessFailure = (): void => {
	mockFs.access.mockImplementation((_path, callback) => {
		const error = new Error("ENOENT") as NodeJS.ErrnoException;
		error.code = "ENOENT";
		(callback as (err: NodeJS.ErrnoException | null) => void)(error);
	});
};
