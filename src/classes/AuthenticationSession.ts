import { logger } from '../logger';
import {
  getFusionAuthClient,
  isPartialClientResponse,
  FusionAuthApiClient,
} from '../fusionAuth';
import type { KeyboardAuthContext } from 'ssh2';
import type { TwoFactorMethod } from '@fusionauth/typescript-client';

enum FusionAuthStatusCode {
  Success = 200,
  SuccessButUnregisteredInApp = 202,
  SuccessNeedsTwoFactorAuth = 242,
}

export class AuthenticationSession {
  public authToken = '';

  public readonly authContext;

  private readonly fusionAuthClient;

  private readonly FusionAuthApiClient;

  private twoFactorId = '';

  private twoFactorMethods: TwoFactorMethod[] = [];

  public constructor(authContext: KeyboardAuthContext) {
    this.authContext = authContext;
    this.fusionAuthClient = getFusionAuthClient();
    this.FusionAuthApiClient = new FusionAuthApiClient();
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
    this.FusionAuthApiClient.login(
      this.authContext.username,
      password,
    ).then((clientResponse) => {
      switch (clientResponse.statusCode) {
        case FusionAuthStatusCode.Success:
        case FusionAuthStatusCode.SuccessButUnregisteredInApp:
          if (clientResponse.response.token !== undefined) {
            logger.verbose('Successful password authentication attempt.', {
              username: this.authContext.username,
            });
            this.authToken = clientResponse.response.token;
            this.authContext.accept();
            return;
          }
          this.authContext.reject();
          return;
        case FusionAuthStatusCode.SuccessNeedsTwoFactorAuth:
          if (clientResponse.response.twoFactorId !== undefined) {
            logger.verbose('Successful password authentication attempt; MFA required.', {
              username: this.authContext.username,
            });
            this.twoFactorId = clientResponse.response.twoFactorId;
            this.twoFactorMethods = clientResponse.response.methods ?? [];
            this.promptForTwoFactorMethod();
            return;
          }
          this.authContext.reject();
          return;
        default:
          logger.verbose('Failed password authentication attempt.', {
            username: this.authContext.username,
            response: clientResponse.response,
          });
          this.authContext.reject();
      }
    }).catch((clientResponse: unknown) => {
      const message = isPartialClientResponse(clientResponse)
        ? clientResponse.exception.message
        : '';
      logger.warn(`Unexpected exception with FusionAuth password login: ${message}`);
      this.authContext.reject();
    });
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
    }).catch((clientResponse: unknown) => {
      const message = isPartialClientResponse(clientResponse)
        ? clientResponse.exception.message
        : '';
      logger.warn(`Unexpected exception with FusionAuth 2FA login: ${message}`);
      this.authContext.reject();
    });
  }
}
