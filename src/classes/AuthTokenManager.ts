import { logger } from "../logger";
import { AuthTokenRefreshError } from "../errors/AuthTokenRefreshError";
import { getFusionAuthClient, isPartialClientResponse } from "../fusionAuth";

export class AuthTokenManager {
	public readonly username: string;

	private readonly fusionAuthClient;

	private refreshToken = "";

	private authToken = "";

	private authTokenExpiresAt = new Date();

	private fusionAuthClientId = "";

	private fusionAuthClientSecret = "";

	public constructor(
		username: string,
		refreshToken: string,
		fusionAuthClientId: string,
		fusionAuthClientSecret: string,
	) {
		this.username = username;
		this.refreshToken = refreshToken;
		this.fusionAuthClientId = fusionAuthClientId;
		this.fusionAuthClientSecret = fusionAuthClientSecret;
		this.fusionAuthClient = getFusionAuthClient();
	}

	public async getAuthToken() {
		if (this.tokenWouldExpireSoon()) {
			await this.resetAuthTokenUsingRefreshToken();
		}
		return this.authToken;
	}

	private async resetAuthTokenUsingRefreshToken(): Promise<void> {
		let clientResponse;
		try {
			/**
			 * Fusion auth sdk wrongly mandates last two params (scope, user_code)
			 * hence the need to pass two empty strings here.
			 * See: https://github.com/FusionAuth/fusionauth-typescript-client/issues/42
			 */
			clientResponse =
				await this.fusionAuthClient.exchangeRefreshTokenForAccessToken(
					this.refreshToken,
					this.fusionAuthClientId,
					this.fusionAuthClientSecret,
					"",
					"",
				);
		} catch (error: unknown) {
			let message: string;
			if (isPartialClientResponse(error)) {
				message = error.exception.error_description ?? error.exception.message;
			} else {
				message =
					error instanceof Error ? error.message : JSON.stringify(error);
			}
			logger.verbose(`Error obtaining refresh token: ${message}`);
			throw new AuthTokenRefreshError(
				`Error obtaining refresh token: ${message}`,
			);
		}

		if (clientResponse.response.access_token === undefined) {
			logger.warn("No access token in response:", clientResponse.response);
			throw new AuthTokenRefreshError("Response does not contain access_token");
		}

		if (clientResponse.response.expires_in === undefined) {
			logger.warn(
				"Response lacks token TTL (expires_in):",
				clientResponse.response,
			);
			throw new AuthTokenRefreshError("Response lacks token TTL (expires_in)");
		}

		/**
		 * The exchange refresh token for access token endpoint does not return a timestamp,
		 * it returns expires_in in seconds.
		 * So we need to create the timestamp to be consistent with what is first
		 * returned upon initial authentication
		 */
		this.authToken = clientResponse.response.access_token;
		this.authTokenExpiresAt = new Date(
			Date.now() + clientResponse.response.expires_in * 1000,
		);
		logger.debug("New access token obtained:", clientResponse.response);
	}

	private tokenWouldExpireSoon(expirationThresholdInSeconds = 300): boolean {
		const currentTime = new Date();
		const remainingTokenLife =
			(this.authTokenExpiresAt.getTime() - currentTime.getTime()) / 1000;
		return remainingTokenLife <= expirationThresholdInSeconds;
	}
}
