import { FusionAuthClient } from "@fusionauth/typescript-client";
import { getFusionAuthClient, isPartialClientResponse } from "./fusionAuth";

jest.mock("@fusionauth/typescript-client");

const MockedFusionAuthClient = FusionAuthClient as jest.MockedClass<typeof FusionAuthClient>;

describe("fusionAuth", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getFusionAuthClient", () => {
		it("should create FusionAuthClient with environment variables", () => {
			process.env.FUSION_AUTH_KEY = "test-key";
			process.env.FUSION_AUTH_HOST = "https://test.fusionauth.com";

			getFusionAuthClient();

			expect(MockedFusionAuthClient).toHaveBeenCalledWith(
				"test-key",
				"https://test.fusionauth.com"
			);
		});

		it("should use empty strings as defaults when environment variables are missing", () => {
			delete process.env.FUSION_AUTH_KEY;
			delete process.env.FUSION_AUTH_HOST;

			getFusionAuthClient();

			expect(MockedFusionAuthClient).toHaveBeenCalledWith("", "");
		});

		it("should create new instance each time", () => {
			process.env.FUSION_AUTH_KEY = "test-key";
			process.env.FUSION_AUTH_HOST = "https://test.fusionauth.com";

			getFusionAuthClient();
			getFusionAuthClient();

			expect(MockedFusionAuthClient).toHaveBeenCalledTimes(2);
		});
	});

	describe("isPartialClientResponse", () => {
		it("should return true for valid PartialClientResponse", () => {
			const validResponse = {
				exception: {
					message: "Test error message"
				}
			};

			expect(isPartialClientResponse(validResponse)).toBe(true);
		});

		it("should return true for PartialClientResponse with optional fields", () => {
			const validResponse = {
				exception: {
					message: "Test error message",
					error: "invalid_request",
					error_description: "The request is invalid"
				}
			};

			expect(isPartialClientResponse(validResponse)).toBe(true);
		});

		it("should return false for null", () => {
			expect(isPartialClientResponse(null)).toBe(false);
		});

		it("should return false for undefined", () => {
			expect(isPartialClientResponse(undefined)).toBe(false);
		});

		it("should return false for primitive values", () => {
			expect(isPartialClientResponse("string")).toBe(false);
			expect(isPartialClientResponse(123)).toBe(false);
			expect(isPartialClientResponse(true)).toBe(false);
		});

		it("should return false for objects without exception property", () => {
			const invalidResponse = {
				message: "No exception property"
			};

			expect(isPartialClientResponse(invalidResponse)).toBe(false);
		});

		it("should return false for empty object", () => {
			expect(isPartialClientResponse({})).toBe(false);
		});

		it("should return false for arrays", () => {
			const arrayResponse = [
				{
					exception: {
						message: "Test error"
					}
				}
			];

			expect(isPartialClientResponse(arrayResponse)).toBe(false);
		});

		it("should return true for object with exception and other properties", () => {
			const validResponse = {
				exception: {
					message: "Test error message"
				},
				otherProperty: "should not matter"
			};

			expect(isPartialClientResponse(validResponse)).toBe(true);
		});
	});
});