import { logger } from '../logger';

export class SftpStreamHandler {
  /**
   * See: SFTP events (OPEN)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public openHandler = (): void => {
    logger.debug('SFTP file open request (SSH_FXP_OPEN)');
  };

  /**
   * See: SFTP events (READ)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public readHandler = (): void => {
    logger.debug('SFTP read file request (SSH_FXP_READ)');
  };

  /**
   * See: SFTP events (WRITE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public writeHandler = (): void => {
    logger.debug('SFTP write file request (SSH_FXP_WRITE)');
  };

  /**
   * See: SFTP events (FSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public fstatHandler = (): void => {
    logger.debug('SFTP read open file statistics request (SSH_FXP_FSTAT)');
  };

  /**
   * See: SFTP events (FSETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public fsetStatHandler = (): void => {
    logger.debug('SFTP write open file statistics request (SSH_FXP_FSETSTAT)');
  };

  /**
   * See: SFTP events (CLOSE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public closeHandler = (): void => {
    logger.debug('SFTP close file request (SSH_FXP_CLOSE)');
  };

  /**
   * See: SFTP events (OPENDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public openDirHandler = (): void => {
    logger.debug('SFTP open directory request (SSH_FXP_OPENDIR)');
  };

  /**
   * See: SFTP events (READDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public readDirHandler = (): void => {
    logger.debug('SFTP read directory request (SSH_FXP_READDIR)');
  };

  /**
   * See: SFTP events (LSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public lstatHandler = (): void => {
    logger.debug('SFTP read file statistics without following symbolic links request (SSH_FXP_LSTAT)');
  };

  /**
   * See: SFTP events (STAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public statHandler = (): void => {
    logger.debug('SFTP read file statistics following symbolic links request (SSH_FXP_STAT)');
  };

  /**
   * See: SFTP events (REMOVE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  public removeHandler = (): void => {
    logger.debug('SFTP remove file request (SSH_FXP_REMOVE)');
  };

  /**
   * See: SFTP events (RMDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public rmDirHandler = (): void => {
    logger.debug('SFTP remove directory request (SSH_FXP_RMDIR)');
  };

  /**
   * See: SFTP events (REALPATH)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Canonicalizing the Server-Side Path Name
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.11
   */
  public realPathHandler = (): void => {
    logger.debug('SFTP canonicalize path request (SSH_FXP_REALPATH)');
  };

  /**
   * See: SFTP events (READLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic Links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  public readLinkHandler = (): void => {
    logger.debug('SFTP read link request (SSH_FXP_READLINK)');
  };

  /**
   * See: SFTP events (SETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public setStatHandler = (): void => {
    logger.debug('SFTP set file attributes request (SSH_FXP_SETSTAT)');
  };

  /**
   * See: SFTP events (MKDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public mkDirHandler = (): void => {
    logger.debug('SFTP create directory request (SSH_FXP_MKDIR)');
  };

  /**
   * See: SFTP events (RENAME)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming FIles
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  public renameHandler = (): void => {
    logger.debug('SFTP file rename request (SSH_FXP_RENAME)');
  };

  /**
   * See: SFTP events (SYMLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  public symLinkHandler = (): void => {
    logger.debug('SFTP create symlink request (SSH_FXP_SYMLINK)');
  };
}
