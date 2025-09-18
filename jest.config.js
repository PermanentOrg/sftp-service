module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: [
		"**/__tests__/**/*.{ts,js}",
		"**/*.(test|spec).{ts,js}"
	],
	testPathIgnorePatterns: [
		"<rootDir>/lib/",
		"<rootDir>/node_modules/",
		"<rootDir>/build/"
	],
	transform: {
		"^.+\\.ts$": "ts-jest"
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	collectCoverage: true,
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html", "json"],
	collectCoverageFrom: [
		"src/**/*.{ts,js}",
		"!src/**/*.d.ts",
		"!src/**/index.ts",
		"!src/instrument.ts",
		"!src/**/*.test.ts",
		"!src/**/*.spec.ts",
		"!src/__tests__/**"
	],
	coverageThreshold: {
		global: {
			branches: 50,
			functions: 50,
			lines: 50,
			statements: 50
		}
	},
	setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
	projects: [
		{
			displayName: "unit",
			preset: "ts-jest",
			testEnvironment: "node",
			testMatch: ["<rootDir>/src/**/*.unit.test.ts"],
			transform: {
				"^.+\\.ts$": "ts-jest"
			},
			moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
			setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"]
		},
		{
			displayName: "integration",
			preset: "ts-jest",
			testEnvironment: "node",
			testMatch: ["<rootDir>/src/**/*.integration.test.ts"],
			transform: {
				"^.+\\.ts$": "ts-jest"
			},
			moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
			globalSetup: "<rootDir>/src/__tests__/integration-setup.ts",
			globalTeardown: "<rootDir>/src/__tests__/integration-teardown.ts",
			setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"]
		}
	],
	verbose: true,
	passWithNoTests: true
};
