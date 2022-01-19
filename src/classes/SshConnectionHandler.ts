import { logger } from '../logger';
import type { AuthContext } from 'ssh2';

export class SshConnectionHandler {
  /**
   * See: Authentication Requests
   * https://datatracker.ietf.org/doc/html/rfc4252#section-5
   */
  public onAuthentication = (authContext: AuthContext): void => {
    logger.debug('SSH authentication request recieved.', {
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

  /**
   * See: Connection Events (close)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onClose = (): void => {
    logger.debug('SSH connection has closed');
  };

  /**
   * See: Connection Events (end)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onEnd = (): void => {
    logger.debug('SSH connection is ending');
  };

  /**
   * See: Connection Events (error)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onError = (error: Error): void => {
    logger.info('SSH error: ', error);
  };

  /**
   * See: Connection Events (handshake)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onHandshake = (): void => {
    logger.debug('SSH handshake complete');
  };

  /**
   * See: Connection Events (ready)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onReady = (): void => {
    logger.debug('SSH connection is ready');
  };

  /**
   * See: Connection Events (rekey)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onRekey = (): void => {
    logger.debug('SSH connection has been re-keyed');
  };

  /**
   * See: Connection Events (request)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onRequest = (): void => {
    logger.debug('SSH request for a resource');
  };

  /**
   * See: Connection Events (session)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onSession = (): void => {
    logger.debug('SSH request for a new session');
  };

  /**
   * See: Connection Events (tcpip)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onTcpip = (): void => {
    logger.debug('SSH request for an outbound TCP connection');
  };
}
