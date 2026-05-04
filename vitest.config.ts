import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		silent: true,
		passWithNoTests: true,
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "istanbul",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/test/**"],
			reportsDirectory: "./coverage",
			reporter: ["text", "lcov"],
		},
	},
});
