import { defineConfig } from "eslint/config";
import typescriptEslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";
import jest from "eslint-plugin-jest";
import js from "@eslint/js";
import love from "eslint-config-love";

export default defineConfig([
	js.configs.recommended,
	typescriptEslint.configs.eslintRecommended,
	typescriptEslint.configs.recommendedTypeChecked,
	typescriptEslint.configs.strict,
	love,
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
			},
		},

		rules: {
			"import/prefer-default-export": "off",
			"import/no-default-export": "error",
			"@typescript-eslint/no-unused-vars": [
				"off", // to be turned on again later
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"import/order": [
				"error",
				{
					groups: [
						"builtin",
						"external",
						"internal",
						"parent",
						"sibling",
						"index",
						"object",
						"type",
					],
					"newlines-between": "never",
				},
			],

			// These rules are disabled because they require code changes.
			// We'll turn them on alongside fixes over time.
			"@typescript-eslint/strict-boolean-expressions": "off",
			"import/enforce-node-protocol-usage": "off",
			"@typescript-eslint/no-magic-numbers": "off",
			"promise/avoid-new": "off",
			"@typescript-eslint/return-await": "off",
			"eslint-comments/require-description": "off",
			"@typescript-eslint/class-methods-use-this": "off",
			"@typescript-eslint/prefer-readonly": "off",
			"@typescript-eslint/no-unnecessary-type-conversion": "off",
			"max-lines": "off",
			"@typescript-eslint/init-declarations": "off",
			"@typescript-eslint/consistent-type-imports": "off",
			"@typescript-eslint/prefer-destructuring": "off",
			complexity: "off",
			"logical-assignment-operators": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/prefer-nullish-coalescing": "off",
		},
	},
	{
		files: ["**/index.ts"],

		rules: {
			// Indexes shouldn't care about the nature of the exports they are collating
			"@typescript-eslint/consistent-type-exports": "off",
		},
	},
	{
		files: ["**/*.test.ts"],

		plugins: {
			jest,
		},

		rules: {
			"max-lines": "off",
			"@typescript-eslint/no-magic-numbers": "off",
		},
	},
]);
