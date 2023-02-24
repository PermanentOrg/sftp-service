import { logger } from '../logger';
import { SftpSessionHandler } from './SftpSessionHandler';
import type { AuthenticationSession } from './AuthenticationSession';
import type { PermanentFileSystemManager } from './PermanentFileSystemManager';
import type {
  Session,
  SFTPWrapper,
} from 'ssh2';

export class SshSessionHandler {
  private readonly permanentFileSystemManager: PermanentFileSystemManager;

  private readonly authenticationSession: AuthenticationSession;

  private readonly session: Session;

  public constructor(
    session: Session,
    authenticationSession: AuthenticationSession,
    permanentFileSystemManager: PermanentFileSystemManager,
  ) {
    this.session = session;
    this.authenticationSession = authenticationSession;
    this.permanentFileSystemManager = permanentFileSystemManager;
  }

  /**
   * See: Session Events (sftp)
   * https://github.com/mscdex/ssh2#session-events
   */
  public onSftp = (
    accept: () => SFTPWrapper,
  ): void => {
    logger.verbose('SFTP requested');
    const sftpConnection = accept();
    const sftpSessionHandler = new SftpSessionHandler(
      sftpConnection,
      this.authenticationSession,
      this.permanentFileSystemManager,
    );
    sftpConnection.on('OPEN', sftpSessionHandler.openHandler);
    sftpConnection.on('READ', sftpSessionHandler.readHandler);
    sftpConnection.on('WRITE', sftpSessionHandler.writeHandler);
    sftpConnection.on('FSTAT', sftpSessionHandler.fstatHandler);
    sftpConnection.on('FSETSTAT', sftpSessionHandler.fsetStatHandler);
    sftpConnection.on('CLOSE', sftpSessionHandler.closeHandler);
    sftpConnection.on('OPENDIR', sftpSessionHandler.openDirHandler);
    sftpConnection.on('READDIR', sftpSessionHandler.readDirHandler);
    sftpConnection.on('LSTAT', sftpSessionHandler.lstatHandler);
    sftpConnection.on('STAT', sftpSessionHandler.statHandler);
    sftpConnection.on('REMOVE', sftpSessionHandler.removeHandler);
    sftpConnection.on('RMDIR', sftpSessionHandler.rmDirHandler);
    sftpConnection.on('REALPATH', sftpSessionHandler.realPathHandler);
    sftpConnection.on('READLINK', sftpSessionHandler.readLinkHandler);
    sftpConnection.on('SETSTAT', sftpSessionHandler.setStatHandler);
    sftpConnection.on('MKDIR', sftpSessionHandler.mkDirHandler);
    sftpConnection.on('RENAME', sftpSessionHandler.renameHandler);
    sftpConnection.on('SYMLINK', sftpSessionHandler.symLinkHandler);
  };

  /**
   * See: Session Events (close)
   * https://github.com/mscdex/ssh2#session-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onClose = (): void => {
    logger.verbose('SSH session closed');
  };

  public onEof = (): void => {
    // This addresses a bug in the ssh2 library where EOF is not properly
    // handled for sftp connections.
    // An upstream PR that would fix the behavior: https://github.com/mscdex/ssh2/pull/1111
    // And some context from our own debugging: https://github.com/PermanentOrg/sftp-service/issues/45
    //
    // The solution here is not ideal, as it is accessing an undocumented attribute that
    // doesn't exist in TypeScript.  As a result I need to disable typescript checks.
    //
    // Once upstream makes that patch this entire handler should become completely unnecessary
    //
    // !!BEWARE: THERE BE DRAGONS HERE!!
    // @ts-expect-error because `_channel` is private / isn't actually documented.
    this.session._channel.end(); // eslint-disable-line max-len, no-underscore-dangle, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  };
}
