import { logger } from '../logger';
import {
  getFusionAuthClient,
  isPartialClientResponse,
} from '../fusionAuth';
import type { KeyboardAuthContext } from 'ssh2';
import type { TwoFactorMethod } from '@fusionauth/typescript-client';

enum FusionAuthStatusCode {
  Success = 200,
  SuccessButUnregisteredInApp = 202,
  SuccessNeedsTwoFactorAuth = 242,
}

type SuccessHandler = (refreshToken: string) => void;

export class AuthenticationSession {
  private readonly authContext;

  private readonly fusionAuthClient;

  private readonly successHandler: SuccessHandler;

  private twoFactorId = '';

  private twoFactorMethods: TwoFactorMethod[] = [];

  private fusionAuthClientId = '';

  public constructor(
    authContext: KeyboardAuthContext,
    fusionAuthClientId: string,
    successHandler: SuccessHandler,
  ) {
    this.authContext = authContext;
    this.fusionAuthClientId = fusionAuthClientId;
    this.fusionAuthClient = getFusionAuthClient();
    this.successHandler = successHandler;
  }

  public invokeAuthenticationFlow(): void {
    this.promptForPassword();
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
      applicationId: this.fusionAuthClientId,
      loginId: this.authContext.username,
      password,
    }).then((clientResponse) => {
      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success.valueOf(): {
          logger.verbose('Successful password authentication attempt.', {
            username: this.authContext.username,
          });
          if (clientResponse.response.refreshToken) {
            this.successHandler(clientResponse.response.refreshToken);
            this.authContext.accept();
          } else {
            logger.warn('No refresh token in response :', clientResponse.response);
            this.authContext.reject();
          }
          return;
        }
        case FusionAuthStatusCode.SuccessButUnregisteredInApp.valueOf(): {
          const userId: string = clientResponse.response.user?.id ?? '';
          this.registerUserInApp(userId)
            .then(() => {
              this.processPasswordResponse([password]);
            })
            .catch((error: unknown) => {
              logger.warn('Error during registration and authentication:', error);
              this.authContext.reject();
            });
          return;
        }
        case FusionAuthStatusCode.SuccessNeedsTwoFactorAuth.valueOf(): {
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
    }).catch((error: unknown) => {
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
          applicationId: this.fusionAuthClientId,
        },
      });

      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success.valueOf():
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
      (method, index) => `[${String(index + 1)}] ${method.method ?? ''}`,
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
        case FusionAuthStatusCode.Success.valueOf():
          logger.verbose('Successful 2FA authentication attempt.', {
            username: this.authContext.username,
          });
          if (clientResponse.response.refreshToken) {
            this.successHandler(clientResponse.response.refreshToken);
            this.authContext.accept();
          } else {
            logger.warn('No refresh token in response :', clientResponse.response);
            this.authContext.reject();
          }
          return;
        case FusionAuthStatusCode.SuccessButUnregisteredInApp.valueOf(): {
          const userId = clientResponse.response.user?.id ?? '';
          this.registerUserInApp(userId)
            .then(() => {
              this.processTwoFactorCodeResponse([twoFactorCode]);
            })
            .catch((error: unknown) => {
              logger.warn('Error during registration and authentication:', error);
              this.authContext.reject();
            });
          return;
        }
        default:
          logger.verbose('Failed 2FA authentication attempt.', {
            username: this.authContext.username,
            method: this.authContext.method,
            response: clientResponse.response,
          });
          this.authContext.reject();
      }
    }).catch((error: unknown) => {
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
