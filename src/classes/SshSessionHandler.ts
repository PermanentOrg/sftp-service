import type { SFTPStream } from 'ssh2-streams';
import { SftpStreamHandler } from './SftpStreamHandler';
import { logger } from '../logger';

export class SshSessionHandler {
  /**
   * See: Session Events (sftp)
   * https://github.com/mscdex/ssh2#session-events
   */
  public onSftp = (
    accept: () => SFTPStream,
  ): void => {
    logger.verbose('SFTP requested');
    const sftp = accept();
    const sftpStreamHandler = new SftpStreamHandler();
    sftp.on('OPEN', sftpStreamHandler.openHandler);
    sftp.on('READ', sftpStreamHandler.readHandler);
    sftp.on('WRITE', sftpStreamHandler.writeHandler);
    sftp.on('FSTAT', sftpStreamHandler.fstatHandler);
    sftp.on('FSETSTAT', sftpStreamHandler.fsetStatHandler);
    sftp.on('CLOSE', sftpStreamHandler.closeHandler);
    sftp.on('OPENDIR', sftpStreamHandler.openDirHandler);
    sftp.on('READDIR', sftpStreamHandler.readDirHandler);
    sftp.on('LSTAT', sftpStreamHandler.lstatHandler);
    sftp.on('STAT', sftpStreamHandler.statHandler);
    sftp.on('REMOVE', sftpStreamHandler.removeHandler);
    sftp.on('RMDIR', sftpStreamHandler.rmDirHandler);
    sftp.on('REALPATH', sftpStreamHandler.realPathHandler);
    sftp.on('READLINK', sftpStreamHandler.readLinkHandler);
    sftp.on('SETSTAT', sftpStreamHandler.setStatHandler);
    sftp.on('MKDIR', sftpStreamHandler.mkDirHandler);
    sftp.on('RENAME', sftpStreamHandler.renameHandler);
    sftp.on('SYMLINK', sftpStreamHandler.symLinkHandler);
  };

  /**
   * See: Session Events (close)
   * https://github.com/mscdex/ssh2#session-events
   */
  public onClose = (): void => {
    logger.verbose('SSH session closed');
  };
}
