import { logger } from '../logger';
import { AuthenticationSession } from './AuthenticationSession';
import { SshSessionHandler } from './SshSessionHandler';
import type {
  AuthContext,
  Session,
} from 'ssh2';

export class SshConnectionHandler {
  private authSession?: AuthenticationSession;

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
      case 'keyboard-interactive': {
        const authenticationSession = new AuthenticationSession(authContext);
        authenticationSession.invokeAuthenticationFlow();
        this.authSession = authenticationSession;
        return;
      }
      case 'none':
      default:
        authContext.reject(
          ['keyboard-interactive'],
        );
    }
  };

  /**
   * See: Connection Events (close)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onClose = (): void => {
    logger.verbose('SSH connection has closed');
  };

  /**
   * See: Connection Events (end)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onEnd = (): void => {
    logger.verbose('SSH connection is ending');
  };

  /**
   * See: Connection Events (error)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onError = (error: Error): void => {
    logger.verbose('SSH error: ', error);
  };

  /**
   * See: Connection Events (handshake)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onHandshake = (): void => {
    logger.verbose('SSH handshake complete');
  };

  /**
   * See: Connection Events (ready)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onReady = (): void => {
    logger.verbose('SSH connection is ready');
  };

  /**
   * See: Connection Events (rekey)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onRekey = (): void => {
    logger.verbose('SSH connection has been re-keyed');
  };

  /**
   * See: Connection Events (request)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
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
    const sessionHandler = new SshSessionHandler(
      session,
      this.authSession?.authToken ?? '',
    );
    session.on('sftp', sessionHandler.onSftp);
    session.on('close', sessionHandler.onClose);
    session.on('eof', sessionHandler.onEof);
  };

  /**
   * See: Connection Events (tcpip)
   * https://github.com/mscdex/ssh2#connection-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onTcpip = (): void => {
    logger.verbose('SSH request for an outbound TCP connection');
  };
}
