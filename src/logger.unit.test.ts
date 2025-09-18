import { logger } from "./logger";

describe("logger", () => {
	let originalNodeEnv: string | undefined;
	let originalLogLevel: string | undefined;

	beforeEach(() => {
		originalNodeEnv = process.env.NODE_ENV;
		originalLogLevel = process.env.LOG_LEVEL;

		// Mock console methods to prevent actual logging during tests
		jest.spyOn(console, 'log').mockImplementation();
		jest.spyOn(console, 'error').mockImplementation();
		jest.spyOn(console, 'warn').mockImplementation();
		jest.spyOn(console, 'info').mockImplementation();
	});

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		process.env.LOG_LEVEL = originalLogLevel;
		jest.restoreAllMocks();
	});

	it("should be defined", () => {
		expect(logger).toBeDefined();
	});

	it("should have expected logging methods", () => {
		expect(typeof logger.error).toBe("function");
		expect(typeof logger.warn).toBe("function");
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.verbose).toBe("function");
		expect(typeof logger.debug).toBe("function");
		expect(typeof logger.silly).toBe("function");
	});

	it("should use debug logger in non-production environment", () => {
		// Reset NODE_ENV to ensure debug logger
		delete process.env.NODE_ENV;

		// Re-require the logger module to get fresh instance
		jest.resetModules();
		const { logger: freshLogger } = require("./logger");

		expect(freshLogger.level).toBe(process.env.LOG_LEVEL ?? "debug");
	});

	it("should respect LOG_LEVEL environment variable", () => {
		process.env.LOG_LEVEL = "warn";

		// Re-require the logger module to get fresh instance
		jest.resetModules();
		const { logger: freshLogger } = require("./logger");

		expect(freshLogger.level).toBe("warn");
	});

	it("should default to debug level for development", () => {
		process.env.NODE_ENV = "development";
		delete process.env.LOG_LEVEL;

		// Re-require the logger module to get fresh instance
		jest.resetModules();
		const { logger: freshLogger } = require("./logger");

		expect(freshLogger.level).toBe("debug");
	});

	it("should default to info level for production", () => {
		process.env.NODE_ENV = "production";
		delete process.env.LOG_LEVEL;

		// Re-require the logger module to get fresh instance
		jest.resetModules();
		const { logger: freshLogger } = require("./logger");

		expect(freshLogger.level).toBe("info");
	});

	it("should be able to log messages", () => {
		expect(() => {
			logger.info("Test message");
			logger.error("Test error");
			logger.warn("Test warning");
			logger.debug("Test debug");
		}).not.toThrow();
	});

	it("should be able to log with metadata", () => {
		expect(() => {
			logger.info("Test message", { key: "value", number: 123 });
		}).not.toThrow();
	});

	it("should be able to log errors with stack traces", () => {
		const error = new Error("Test error message");

		expect(() => {
			logger.error("An error occurred", error);
		}).not.toThrow();
	});
});