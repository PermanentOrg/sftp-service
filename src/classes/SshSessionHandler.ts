import { SftpSessionHandler } from './SftpSessionHandler';
import { logger } from '../logger';
import type { SFTPWrapper } from 'ssh2';

export class SshSessionHandler {
  private readonly authToken: string;

  public constructor(authToken: string) {
    this.authToken = authToken;
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
      this.authToken,
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
  public onClose = (): void => {
    logger.verbose('SSH session closed');
  };
}
