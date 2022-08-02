import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ssh2 from 'ssh2';
import { logger } from '../logger';
import {
  generateFileEntry,
  getFileType,
  generateDefaultAttributes,
} from '../utils';
import { PermanentFileSystem } from './PermanentFileSystem';
import type {
  Attributes,
  FileEntry,
  SFTPWrapper,
} from 'ssh2';

const SFTP_STATUS_CODE = ssh2.utils.sftp.STATUS_CODE;

const generateHandle = (): string => uuidv4();

export class SftpSessionHandler {
  private readonly sftpConnection: SFTPWrapper;

  private readonly openDirectories: Map<string, FileEntry[]> = new Map();

  private readonly openFiles: Map<string, Buffer> = new Map();

  private readonly permanentFileSystem: PermanentFileSystem;

  public constructor(
    sftpConnection: SFTPWrapper,
    authToken: string,
  ) {
    this.sftpConnection = sftpConnection;
    this.permanentFileSystem = new PermanentFileSystem(authToken);
  }

  /**
   * See: SFTP events (OPEN)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public openHandler = (
    reqId: number,
    filename: string,
    flags: number,
    attrs: Attributes,
  ): void => {
    logger.verbose('SFTP file open request (SSH_FXP_OPEN)');
    logger.debug('Request:', {
      reqId,
      filename,
      flags,
      attrs,
    });
    const handle = generateHandle();
    logger.debug(`Opening ${filename}: ${handle}`);
    this.openFiles.set(handle, Buffer.from('content goes here'));
    logger.debug('Response:', { reqId, handle });
    this.sftpConnection.handle(
      reqId,
      Buffer.from(handle),
    );
  };

  /**
   * See: SFTP events (READ)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  // eslint-disable-next-line class-methods-use-this
  public readHandler = (): void => {
    logger.verbose('SFTP read file request (SSH_FXP_READ)');
  };

  /**
   * See: SFTP events (WRITE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  // eslint-disable-next-line class-methods-use-this
  public writeHandler = (): void => {
    logger.verbose('SFTP write file request (SSH_FXP_WRITE)');
  };

  /**
   * See: SFTP events (FSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  // eslint-disable-next-line class-methods-use-this
  public fstatHandler = (): void => {
    logger.verbose('SFTP read open file statistics request (SSH_FXP_FSTAT)');
  };

  /**
   * See: SFTP events (FSETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  // eslint-disable-next-line class-methods-use-this
  public fsetStatHandler = (): void => {
    logger.verbose('SFTP write open file statistics request (SSH_FXP_FSETSTAT)');
  };

  /**
   * See: SFTP events (CLOSE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public closeHandler = (reqId: number, handle: Buffer): void => {
    logger.verbose('SFTP close file request (SSH_FXP_CLOSE)');
    logger.debug('Request:', { reqId, handle });
    this.openDirectories.delete(handle.toString());
    logger.debug('Response: Status (OK)', { reqId }, SFTP_STATUS_CODE.OK);
    this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
  };

  /**
   * See: SFTP events (OPENDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public openDirHandler = (reqId: number, dirPath: string): void => {
    logger.verbose('SFTP open directory request (SSH_FXP_OPENDIR)');
    logger.debug('Request:', { reqId, dirPath });
    const handle = generateHandle();
    logger.debug(`Opening ${dirPath}:`, handle);
    this.permanentFileSystem.loadDirectory(dirPath)
      .then((fileEntries) => {
        logger.debug('Contents:', fileEntries);
        this.openDirectories.set(handle, fileEntries);
        logger.debug('Response:', { reqId, handle });
        this.sftpConnection.handle(
          reqId,
          Buffer.from(handle),
        );
      })
      .catch((reason: unknown) => {
        logger.error('Failed to load path', { reqId, dirPath, reason });
        logger.debug('Response: Status (FAILURE)', { reqId }, SFTP_STATUS_CODE.FAILURE);
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      });
  };

  /**
   * See: SFTP events (READDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public readDirHandler = (reqId: number, handle: Buffer): void => {
    logger.verbose('SFTP read directory request (SSH_FXP_READDIR)');
    logger.debug('Request:', { reqId, handle });
    const names = this.openDirectories.get(handle.toString()) ?? [];
    if (names.length !== 0) {
      logger.debug('Response:', { reqId, names });
      this.openDirectories.set(handle.toString(), []);
      this.sftpConnection.name(reqId, names);
    } else {
      logger.debug('Response: Status (EOF)', { reqId }, SFTP_STATUS_CODE.EOF);
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.EOF);
    }
  };

  /**
   * See: SFTP events (LSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  // eslint-disable-next-line class-methods-use-this
  public lstatHandler = (): void => {
    logger.verbose('SFTP read file statistics without following symbolic links request (SSH_FXP_LSTAT)');
  };

  /**
   * See: SFTP events (STAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  // eslint-disable-next-line class-methods-use-this
  public statHandler = (reqId: number, handle: Buffer): void => {
    logger.verbose('SFTP read file statistics following symbolic links request (SSH_FXP_STAT)');
    logger.debug('Request:', { reqId, handle });
    const fileType = getFileType(handle.toString());
    const attrs = generateDefaultAttributes(fileType);
    logger.debug('Response:', { reqId, attrs });
    this.sftpConnection.attrs(
      reqId,
      attrs,
    );
  };

  /**
   * See: SFTP events (REMOVE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  // eslint-disable-next-line class-methods-use-this
  public removeHandler = (): void => {
    logger.verbose('SFTP remove file request (SSH_FXP_REMOVE)');
  };

  /**
   * See: SFTP events (RMDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  // eslint-disable-next-line class-methods-use-this
  public rmDirHandler = (): void => {
    logger.verbose('SFTP remove directory request (SSH_FXP_RMDIR)');
  };

  /**
   * See: SFTP events (REALPATH)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Canonicalizing the Server-Side Path Name
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.11
   */
  public realPathHandler = (reqId: number, relativePath: string): void => {
    logger.verbose('SFTP canonicalize path request (SSH_FXP_REALPATH)');
    logger.debug('Request:', { reqId, relativePath });
    const resolvedPath = path.resolve('/', relativePath);
    const fileType = getFileType(resolvedPath);
    const fileEntry = generateFileEntry(
      resolvedPath,
      generateDefaultAttributes(fileType),
    );
    const names = [fileEntry];
    logger.debug('Response:', { reqId, names });
    this.sftpConnection.name(reqId, names);
  };

  /**
   * See: SFTP events (READLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic Links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  // eslint-disable-next-line class-methods-use-this
  public readLinkHandler = (): void => {
    logger.verbose('SFTP read link request (SSH_FXP_READLINK)');
  };

  /**
   * See: SFTP events (SETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  // eslint-disable-next-line class-methods-use-this
  public setStatHandler = (): void => {
    logger.verbose('SFTP set file attributes request (SSH_FXP_SETSTAT)');
  };

  /**
   * See: SFTP events (MKDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  // eslint-disable-next-line class-methods-use-this
  public mkDirHandler = (): void => {
    logger.verbose('SFTP create directory request (SSH_FXP_MKDIR)');
  };

  /**
   * See: SFTP events (RENAME)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming FIles
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  // eslint-disable-next-line class-methods-use-this
  public renameHandler = (): void => {
    logger.verbose('SFTP file rename request (SSH_FXP_RENAME)');
  };

  /**
   * See: SFTP events (SYMLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  // eslint-disable-next-line class-methods-use-this
  public symLinkHandler = (): void => {
    logger.verbose('SFTP create symlink request (SSH_FXP_SYMLINK)');
  };
}
