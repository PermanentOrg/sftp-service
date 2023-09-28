import { logger } from '../logger';
import {
  getFusionAuthClient,
  isPartialClientResponse,
} from '../fusionAuth';
import { AuthTokenRefreshError } from '../errors/AuthTokenRefreshError';
import type { KeyboardAuthContext } from 'ssh2';
import type { TwoFactorMethod } from '@fusionauth/typescript-client';

enum FusionAuthStatusCode {
  Success = 200,
  SuccessButUnregisteredInApp = 202,
  SuccessNeedsTwoFactorAuth = 242,
}

export class AuthenticationSession {
  private authToken = '';

  public refreshToken = '';

  public readonly authContext;

  private authTokenExpiresAt = new Date();

  private readonly fusionAuthClient;

  private twoFactorId = '';

  private twoFactorMethods: TwoFactorMethod[] = [];

  private fusionAuthAppId = '';

  private fusionAuthClientId = '';

  private fusionAuthClientSecret = '';

  public constructor(
    authContext: KeyboardAuthContext,
    fusionAuthAppId: string,
    fusionAuthClientId: string,
    fusionAuthClientSecret: string,
  ) {
    this.authContext = authContext;
    this.fusionAuthAppId = fusionAuthAppId;
    this.fusionAuthClientId = fusionAuthClientId;
    this.fusionAuthClientSecret = fusionAuthClientSecret;
    this.fusionAuthClient = getFusionAuthClient();
  }

  public invokeAuthenticationFlow(): void {
    this.promptForPassword();
  }

  public async getAuthToken() {
    if (this.tokenWouldExpireSoon()) {
      await this.getAuthTokenUsingRefreshToken();
    }
    return this.authToken;
  }

  private async getAuthTokenUsingRefreshToken(): Promise<void> {
    let clientResponse;
    try {
      /**
       * Fusion auth sdk wrongly mandates last two params (scope, user_code)
       * hence the need to pass two empty strings here.
       * See: https://github.com/FusionAuth/fusionauth-typescript-client/issues/42
       */
      clientResponse = await this.fusionAuthClient.exchangeRefreshTokenForAccessToken(
        this.refreshToken,
        this.fusionAuthClientId,
        this.fusionAuthClientSecret,
        '',
        '',
      );
    } catch (error: unknown) {
      let message: string;
      if (isPartialClientResponse(error)) {
        message = error.exception.message;
      } else {
        message = error instanceof Error ? error.message : JSON.stringify(error);
      }
      logger.verbose(`Error obtaining refresh token: ${message}`);
      throw new AuthTokenRefreshError(`Error obtaining refresh token: ${message}`);
    }

    if (!clientResponse.response.access_token) {
      logger.warn('No access token in response:', clientResponse.response);
      throw new AuthTokenRefreshError('Response does not contain access_token');
    }

    if (!clientResponse.response.expires_in) {
      logger.warn('Response lacks token TTL (expires_in):', clientResponse.response);
      throw new AuthTokenRefreshError('Response lacks token TTL (expires_in)');
    }

    /**
     * The exchange refresh token for access token endpoint does not return a timestamp,
     * it returns expires_in in seconds.
     * So we need to create the timestamp to be consistent with what is first
     * returned upon initial authentication
     */
    this.authToken = clientResponse.response.access_token;
    this.authTokenExpiresAt = new Date(
      Date.now() + (clientResponse.response.expires_in * 1000),
    );
    logger.debug('New access token obtained:', clientResponse.response);
  }

  private tokenWouldExpireSoon(expirationThresholdInSeconds = 300): boolean {
    const currentTime = new Date();
    const remainingTokenLife = (
      (this.authTokenExpiresAt.getTime() - currentTime.getTime()) / 1000
    );
    return remainingTokenLife <= expirationThresholdInSeconds;
  }

  private promptForPassword(): void {
    this.authContext.prompt(
      {
        prompt: 'password: ',
        echo: false,
      },
      'Password',
      'Please enter your Permanent.org password.',
      this.processPasswordResponse.bind(this),
    );
  }

  private processPasswordResponse([password]: string[]): void {
    this.fusionAuthClient.login({
      applicationId: this.fusionAuthAppId,
      loginId: this.authContext.username,
      password,
    }).then((clientResponse) => {
      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success: {
          if (clientResponse.response.token !== undefined) {
            logger.verbose('Successful password authentication attempt.', {
              username: this.authContext.username,
            });
            this.authToken = clientResponse.response.token;
            if (clientResponse.response.refreshToken) {
              this.refreshToken = clientResponse.response.refreshToken;
              this.authTokenExpiresAt = new Date(
                clientResponse.response.tokenExpirationInstant ?? 0,
              );
            } else {
              logger.warn('No refresh token in response :', clientResponse.response);
              this.authContext.reject();
            }
            this.authContext.accept();
          } else {
            logger.warn('No auth token in response', clientResponse.response);
            this.authContext.reject();
          }
          return;
        }
        case FusionAuthStatusCode.SuccessButUnregisteredInApp: {
          const userId: string = clientResponse.response.user?.id ?? '';
          this.registerUserInApp(userId)
            .then(() => { this.processPasswordResponse([password]); })
            .catch((error) => {
              logger.warn('Error during registration and authentication:', error);
              this.authContext.reject();
            });
          return;
        }
        case FusionAuthStatusCode.SuccessNeedsTwoFactorAuth: {
          if (clientResponse.response.twoFactorId !== undefined) {
            logger.verbose('Successful password authentication attempt; MFA required.', {
              username: this.authContext.username,
            });
            this.twoFactorId = clientResponse.response.twoFactorId;
            this.twoFactorMethods = clientResponse.response.methods ?? [];
            this.promptForTwoFactorMethod();
          } else {
            this.authContext.reject();
          }
          return;
        }
        default: {
          logger.verbose('Failed password authentication attempt.', {
            username: this.authContext.username,
            response: clientResponse.response,
          });
          this.authContext.reject();
        }
      }
    }).catch((error) => {
      let message: string;
      if (isPartialClientResponse(error)) {
        message = error.exception.message;
      } else {
        message = error instanceof Error ? error.message : JSON.stringify(error);
      }
      logger.warn(`Unexpected exception with FusionAuth password login: ${message}`);
      this.authContext.reject();
    });
  }

  private async registerUserInApp(userId: string): Promise<void> {
    try {
      const clientResponse = await this.fusionAuthClient.register(userId, {
        registration: {
          applicationId: this.fusionAuthAppId,
        },
      });

      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success:
          logger.verbose('User registered successfully after authentication.', {
            userId,
          });
          break;
        default:
          logger.verbose('User registration after authentication failed.', {
            userId,
            response: clientResponse.response,
          });
      }
    } catch (error) {
      logger.warn('Error during user registration after authentication:', error);
    }
  }

  private promptForTwoFactorMethod(): void {
    const promptOptions = this.twoFactorMethods.map(
      (method, index) => `[${index + 1}] ${method.method ?? ''}`,
    );
    this.authContext.prompt(
      [{
        prompt: 'method: ',
        echo: true,
      }],
      'MFA Method',
      `Select an MFA method for ${this.authContext.username}:\n${promptOptions.join('\n')}`,
      this.processTwoFactorMethodResponse.bind(this),
    );
  }

  private processTwoFactorMethodResponse([methodIndex]: string[]): void {
    logger.verbose('MFA method selection made.', {
      username: this.authContext.username,
      methodIndex,
    });
    const selection = Number.parseInt(
      methodIndex,
      10,
    );
    if (Number.isNaN(selection)
      || selection > this.twoFactorMethods.length
      || selection < 1) {
      this.authContext.reject();
      return;
    }
    this.fusionAuthClient.sendTwoFactorCodeForLoginUsingMethod(
      this.twoFactorId,
      { methodId: this.twoFactorMethods[selection - 1].id },
    ).then(() => {
      this.promptForTwoFactorCode();
    }).catch((error: unknown) => {
      logger.warn('There was an issue sending the two factor code');
      logger.warn(error);
      this.authContext.reject();
    });
  }

  private promptForTwoFactorCode(): void {
    this.authContext.prompt(
      [{
        prompt: 'MFA code: ',
        echo: true,
      }],
      'MFA Code',
      'Please find the code that was just sent to your device.',
      this.processTwoFactorCodeResponse.bind(this),
    );
  }

  private processTwoFactorCodeResponse([twoFactorCode]: string[]): void {
    this.fusionAuthClient.twoFactorLogin({
      twoFactorId: this.twoFactorId,
      code: twoFactorCode,
    }).then((clientResponse) => {
      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success:
        case FusionAuthStatusCode.SuccessButUnregisteredInApp:
          if (clientResponse.response.token !== undefined) {
            logger.verbose('Successful 2FA authentication attempt.', {
              username: this.authContext.username,
            });
            this.authToken = clientResponse.response.token;
            this.authContext.accept();
            return;
          }
          this.authContext.reject();
          return;
        default:
          logger.verbose('Failed 2FA authentication attempt.', {
            username: this.authContext.username,
            method: this.authContext.method,
            response: clientResponse.response,
          });
          this.authContext.reject();
      }
    }).catch((error) => {
      let message: string;
      if (isPartialClientResponse(error)) {
        message = error.exception.message;
      } else {
        message = error instanceof Error ? error.message : JSON.stringify(error);
      }
      logger.warn(`Unexpected exception with FusionAuth 2FA login: ${message}`);
      this.authContext.reject();
    });
  }
}
