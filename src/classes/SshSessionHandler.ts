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
  public onSftp(
    accept: () => SFTPWrapper,
  ): void {
    logger.verbose('SFTP requested');
    const sftpConnection = accept();
    const sftpSessionHandler = new SftpSessionHandler(
      sftpConnection,
      this.authenticationSession,
      this.permanentFileSystemManager,
    );
    sftpConnection.on('OPEN', sftpSessionHandler.openHandler.bind(sftpSessionHandler));
    sftpConnection.on('READ', sftpSessionHandler.readHandler.bind(sftpSessionHandler));
    sftpConnection.on('WRITE', sftpSessionHandler.writeHandler.bind(sftpSessionHandler));
    sftpConnection.on('FSTAT', sftpSessionHandler.fstatHandler.bind(sftpSessionHandler));
    sftpConnection.on('FSETSTAT', sftpSessionHandler.fsetStatHandler.bind(sftpSessionHandler));
    sftpConnection.on('CLOSE', sftpSessionHandler.closeHandler.bind(sftpSessionHandler));
    sftpConnection.on('OPENDIR', sftpSessionHandler.openDirHandler.bind(sftpSessionHandler));
    sftpConnection.on('READDIR', sftpSessionHandler.readDirHandler.bind(sftpSessionHandler));
    sftpConnection.on('LSTAT', sftpSessionHandler.lstatHandler.bind(sftpSessionHandler));
    sftpConnection.on('STAT', sftpSessionHandler.statHandler.bind(sftpSessionHandler));
    sftpConnection.on('REMOVE', sftpSessionHandler.removeHandler.bind(sftpSessionHandler));
    sftpConnection.on('RMDIR', sftpSessionHandler.rmDirHandler.bind(sftpSessionHandler));
    sftpConnection.on('REALPATH', sftpSessionHandler.realPathHandler.bind(sftpSessionHandler));
    sftpConnection.on('READLINK', sftpSessionHandler.readLinkHandler.bind(sftpSessionHandler));
    sftpConnection.on('SETSTAT', sftpSessionHandler.setStatHandler.bind(sftpSessionHandler));
    sftpConnection.on('MKDIR', sftpSessionHandler.mkDirHandler.bind(sftpSessionHandler));
    sftpConnection.on('RENAME', sftpSessionHandler.renameHandler.bind(sftpSessionHandler));
    sftpConnection.on('SYMLINK', sftpSessionHandler.symLinkHandler.bind(sftpSessionHandler));
  }

  /**
   * See: Session Events (close)
   * https://github.com/mscdex/ssh2#session-events
   */
  // eslint-disable-next-line class-methods-use-this
  public onClose(): void {
    logger.verbose('SSH session closed');
  }

  public onEof(): void {
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
  }
}
