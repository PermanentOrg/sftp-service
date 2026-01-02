module.exports = {
	roots: ["<rootDir>/src"],
	silent: true,
	passWithNoTests: true,
	preset: "ts-jest",
	collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov"],
};
