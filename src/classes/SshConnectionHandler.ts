import { logger } from '../logger';
import { SshSessionHandler } from './SshSessionHandler';
import type {
  AuthContext,
  Session,
} from 'ssh2';

export class SshConnectionHandler {
  private authToken = '';

  /**
   * See: Authentication Requests
   * https://datatracker.ietf.org/doc/html/rfc4252#section-5
   */
  public onAuthentication = (authContext: AuthContext): void => {
    logger.verbose('SSH authentication request recieved.', {
      username: authContext.username,
      method: authContext.method,
    });
    switch (authContext.method) {
      case 'password':
        authContext.accept();
        // THIS IS COMPLETELY TEMPORARY FOR THE DEMO
        // This bearer token is to a local test account so it's not actually a secret in any way
        // ^ I mention this in case / for when I commit it to my demo branch on github.
        this.authToken = `${process.env.LOCAL_TEMPORARY_AUTH_TOKEN ?? ''}`;
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
    logger.verbose('SSH connection has closed');
  };

  /**
   * See: Connection Events (end)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onEnd = (): void => {
    logger.verbose('SSH connection is ending');
  };

  /**
   * See: Connection Events (error)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onError = (error: Error): void => {
    logger.verbose('SSH error: ', error);
  };

  /**
   * See: Connection Events (handshake)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onHandshake = (): void => {
    logger.verbose('SSH handshake complete');
  };

  /**
   * See: Connection Events (ready)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onReady = (): void => {
    logger.verbose('SSH connection is ready');
  };

  /**
   * See: Connection Events (rekey)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onRekey = (): void => {
    logger.verbose('SSH connection has been re-keyed');
  };

  /**
   * See: Connection Events (request)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onRequest = (): void => {
    logger.verbose('SSH request for a resource');
  };

  /**
   * See: Connection Events (session)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onSession = (
    accept: () => Session,
  ): void => {
    logger.verbose('SSH request for a new session');
    const session = accept();
    const sessionHandler = new SshSessionHandler(this.authToken);
    session.on('sftp', sessionHandler.onSftp);
    session.on('close', sessionHandler.onClose);
  };

  /**
   * See: Connection Events (tcpip)
   * https://github.com/mscdex/ssh2#connection-events
   */
  public onTcpip = (): void => {
    logger.verbose('SSH request for an outbound TCP connection');
  };
}
