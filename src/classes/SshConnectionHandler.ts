import { logger } from '../logger';
import type { AuthContext } from 'ssh2';

export class SshConnectionHandler {
  /**
   * See: Authentication Requests
   * https://datatracker.ietf.org/doc/html/rfc4252#section-5
   */
  public onAuthentication = (authContext: AuthContext): void => {
    logger.debug('Authentication request recieved.', {
      username: authContext.username,
      method: authContext.method,
    });
    switch (authContext.method) {
      case 'password':
        authContext.accept();
        return;
      case 'none':
      default:
        authContext.reject(
          ['password'],
        );
        return;
    }
  };

  public onClose = (): void => {};

  public onEnd = (): void => {};

  public onError = (): void => {};

  public onHandshake = (): void => {};

  public onReady = (): void => {};

  public onRekey = (): void => {};

  public onRequest = (): void => {};

  public onSession = (): void => {};

  public onTcpip = (): void => {};

}
