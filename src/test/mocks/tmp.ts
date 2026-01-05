import tmp from "tmp";

export const mockTmp = jest.mocked(tmp);

export const mockTmpFileSuccess = (
	name = "/tmp/test-file",
	fd = 123,
	removeCallback = jest.fn(),
): jest.Mock => {
	mockTmp.file.mockImplementation((callback) => {
		callback(null, name, fd, removeCallback);
	});
	return removeCallback;
};

export const mockTmpFileFailure = (error: Error): void => {
	mockTmp.file.mockImplementation((callback) => {
		callback(error, "", 0, jest.fn());
	});
};
