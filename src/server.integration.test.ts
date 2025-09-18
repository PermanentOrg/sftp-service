import { server } from "./server";
import { PermanentFileSystemManager } from "./classes";

jest.mock("./classes");
jest.mock("./logger");
jest.mock("require-env-variable");
jest.mock("fs");

const mockPermanentFileSystemManager = PermanentFileSystemManager as jest.MockedClass<typeof PermanentFileSystemManager>;

describe("Server Integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Mock environment variables
		process.env.SSH_HOST_KEY_PATH = "/tmp/test_host_key";
		process.env.FUSION_AUTH_HOST = "https://test.fusionauth.com";
		process.env.FUSION_AUTH_KEY = "test-key";
		process.env.PERMANENT_API_BASE_PATH = "https://test-api.permanent.org";
		process.env.STELA_API_BASE_PATH = "https://test-stela.permanent.org";
		process.env.FUSION_AUTH_SFTP_CLIENT_ID = "test-client-id";
		process.env.FUSION_AUTH_SFTP_CLIENT_SECRET = "test-client-secret";

		// Mock require-env-variable to return our test values
		const requireEnvVariable = require("require-env-variable");
		requireEnvVariable.mockReturnValue({
			SSH_HOST_KEY_PATH: "/tmp/test_host_key",
			FUSION_AUTH_SFTP_CLIENT_ID: "test-client-id",
			FUSION_AUTH_SFTP_CLIENT_SECRET: "test-client-secret"
		});

		// Mock fs.readFileSync to return a fake host key
		const fs = require("fs");
		fs.readFileSync.mockReturnValue("fake-host-key-content");
	});

	afterEach(() => {
		if (server.listening) {
			server.close();
		}
	});

	it("should create server instance successfully", () => {
		expect(server).toBeDefined();
		expect(typeof server.listen).toBe("function");
		expect(typeof server.close).toBe("function");
	});

	it("should initialize PermanentFileSystemManager", () => {
		expect(mockPermanentFileSystemManager).toHaveBeenCalledTimes(1);
	});

	it("should be able to start and stop server", (done) => {
		const testPort = 0; // Use port 0 to get any available port

		server.listen(testPort, "127.0.0.1", () => {
			expect(server.listening).toBe(true);

			server.close((err) => {
				expect(err).toBeUndefined();
				expect(server.listening).toBe(false);
				done();
			});
		});
	});

	it("should handle server errors gracefully", (done) => {
		server.on("error", (error: Error) => {
			expect(error).toBeDefined();
			done();
		});

		// Try to listen on an invalid port to trigger an error
		server.listen(-1);
	});

	it("should set up connection event listener", () => {
		// The server should have listeners for the 'connection' event
		const listeners = server.listeners('connection');
		expect(listeners.length).toBeGreaterThan(0);
	});
});