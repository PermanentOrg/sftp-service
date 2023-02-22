import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import ssh2 from 'ssh2';
import tmp from 'tmp';
import { logger } from '../logger';
import { generateFileEntry } from '../utils';
import { PermanentFileSystem } from './PermanentFileSystem';
import type { FileResult } from 'tmp';
import type {
  Attributes,
  FileEntry,
  SFTPWrapper,
} from 'ssh2';
import type {
  File,
} from '@permanentorg/sdk';

const SFTP_STATUS_CODE = ssh2.utils.sftp.STATUS_CODE;

const generateHandle = (): string => uuidv4();

interface TemporaryFile extends FileResult {
  path: string;
}

export class SftpSessionHandler {
  private readonly sftpConnection: SFTPWrapper;

  private readonly openDirectories: Map<string, FileEntry[]> = new Map();

  private readonly openFiles: Map<string, File> = new Map();

  private readonly openTemporaryFiles = new Map<string, TemporaryFile>();

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
    filePath: string,
    flags: number,
    attrs: Attributes,
  ): void => {
    logger.verbose(
      'Request: SFTP file open (SSH_FXP_OPEN)',
      {
        reqId,
        filePath,
        flags,
        attrs,
      },
    );
    this.permanentFileSystem.getItemType(filePath)
      .then((fileType) => {
        switch (fileType) {
          case fs.constants.S_IFDIR:
            logger.verbose(
              'Response: Status (FILE_IS_A_DIRECTORY)',
              {
                reqId,
                code: SFTP_STATUS_CODE.FILE_IS_A_DIRECTORY,
              },
            );
            this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FILE_IS_A_DIRECTORY);
            break;
          default: {
            this.openExistingFileHandler(
              reqId,
              filePath,
              flags,
            );
            break;
          }
        }
      }).catch(() => {
        this.openNewFileHandler(
          reqId,
          filePath,
          flags,
        );
      });
  };

  /**
   * See: SFTP events (READ)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public readHandler = (
    reqId: number,
    handle: Buffer,
    offset: number,
    length: number,
  ): void => {
    logger.verbose(
      'Request: SFTP read file (SSH_FXP_READ)',
      {
        reqId,
        handle,
        offset,
        length,
      },
    );
    const file = this.openFiles.get(handle.toString());
    if (!file) {
      logger.info('There is no open file associated with this handle', { reqId, handle });
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      return;
    }

    if (offset >= file.size) {
      logger.verbose(
        'Response: Status (EOF)',
        {
          reqId,
          code: SFTP_STATUS_CODE.EOF,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.EOF);
      return;
    }

    fetch(file.downloadUrl, {
      headers: {
        Range: `bytes=${offset}-${offset + length - 1}`,
      },
    })
      .then(async (response) => {
        const data = await response.buffer();
        logger.verbose('Response: Data', { reqId });
        logger.silly('Sent data...', { data });
        this.sftpConnection.data(
          reqId,
          data,
        );
      })
      .catch((reason: unknown) => {
        logger.warn('Failed to read data', {
          reqId,
          handle,
          offset,
          length,
        });
        logger.warn(reason);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      });
  };

  /**
   * See: SFTP events (WRITE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public writeHandler = (
    reqId: number,
    handle: Buffer,
    offset: number,
    data: Buffer,
  ): void => {
    logger.verbose(
      'Request: SFTP write file (SSH_FXP_WRITE)',
      { reqId, handle, offset },
    );
    logger.silly(
      'Request Data:',
      { reqId, data },
    );
    const temporaryFile = this.openTemporaryFiles.get(handle.toString());
    if (!temporaryFile) {
      logger.debug('There is no open temporary file associated with this handle', { reqId, handle });
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      return;
    }
    fs.write(
      temporaryFile.fd,
      data,
      0,
      (err, written, buffer) => {
        if (err) {
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
          return;
        }
        logger.debug('Successful Write.', { reqId, handle, written });
        logger.silly('Written Data:', { buffer });
        logger.verbose(
          'Response: Status (OK)',
          {
            reqId,
            code: SFTP_STATUS_CODE.OK,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
      },
    );
  };

  /**
   * See: SFTP events (FSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public fstatHandler = (
    reqId: number,
    itemPath: Buffer,
  ): void => {
    logger.verbose(
      'Request: SFTP read open file statistics (SSH_FXP_FSTAT)',
      { reqId, itemPath },
    );
    const file = this.openFiles.get(itemPath.toString());
    if (!file) {
      logger.debug('There is no open file associated with this path', { reqId, itemPath });
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      return;
    }
    this.genericStatHandler(reqId, itemPath);
  };

  /**
   * See: SFTP events (FSETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  // eslint-disable-next-line class-methods-use-this
  public fsetStatHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP write open file statistics (SSH_FXP_FSETSTAT)');
  };

  /**
   * See: SFTP events (CLOSE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public closeHandler = (reqId: number, handle: Buffer): void => {
    logger.verbose(
      'Request: SFTP close file (SSH_FXP_CLOSE)',
      { reqId, handle },
    );
    const temporaryFile = this.openTemporaryFiles.get(handle.toString());
    if (temporaryFile) {
      fs.close(temporaryFile.fd);
      const { size } = fs.statSync(temporaryFile.name);
      this.permanentFileSystem.createFile(
        temporaryFile.path,
        fs.createReadStream(temporaryFile.name),
        size,
      ).then(() => {
        temporaryFile.removeCallback();
        this.openTemporaryFiles.delete(handle.toString());
        logger.verbose(
          'Response: Status (OK)',
          {
            reqId,
            code: SFTP_STATUS_CODE.OK,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
      }).catch((err) => {
        logger.verbose(err);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      });
      return;
    }
    this.openFiles.delete(handle.toString());
    logger.verbose(
      'Response: Status (OK)',
      {
        reqId,
        code: SFTP_STATUS_CODE.OK,
      },
    );
    this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
  };

  /**
   * See: SFTP events (OPENDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public openDirHandler = (reqId: number, dirPath: string): void => {
    logger.verbose(
      'SFTP open directory request (SSH_FXP_OPENDIR)',
      { reqId, dirPath },
    );
    const handle = generateHandle();
    logger.debug(`Opening directory ${dirPath}:`, handle);
    this.permanentFileSystem.loadDirectory(dirPath)
      .then((fileEntries) => {
        logger.debug('Contents:', fileEntries);
        this.openDirectories.set(handle, fileEntries);
        logger.verbose('Response: Handle', { reqId, handle });
        this.sftpConnection.handle(
          reqId,
          Buffer.from(handle),
        );
      })
      .catch((reason: unknown) => {
        logger.warn('Failed to load path', { reqId, dirPath });
        logger.warn(reason);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
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
    logger.verbose(
      'Request: SFTP read directory (SSH_FXP_READDIR)',
      { reqId, handle },
    );
    const names = this.openDirectories.get(handle.toString()) ?? [];
    if (names.length !== 0) {
      logger.verbose('Response: Name', { reqId, names });
      this.openDirectories.set(handle.toString(), []);
      this.sftpConnection.name(reqId, names);
    } else {
      logger.verbose(
        'Response: Status (EOF)',
        {
          reqId,
          code: SFTP_STATUS_CODE.EOF,
        },
      );
      this.openDirectories.delete(handle.toString());
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.EOF);
    }
  };

  /**
   * See: SFTP events (LSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public lstatHandler = (
    reqId: number,
    itemPath: Buffer,
  ): void => {
    logger.verbose(
      'Request: SFTP read file statistics without following symbolic links (SSH_FXP_LSTAT)',
      { reqId, itemPath },
    );
    this.genericStatHandler(reqId, itemPath);
  };

  /**
   * See: SFTP events (STAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public statHandler = (
    reqId: number,
    itemPath: Buffer,
  ): void => {
    logger.verbose(
      'Request: SFTP read file statistics following symbolic links (SSH_FXP_STAT)',
      { reqId, itemPath },
    );
    this.genericStatHandler(reqId, itemPath);
  };

  /**
   * See: SFTP events (REMOVE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  // eslint-disable-next-line class-methods-use-this
  public removeHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP remove file (SSH_FXP_REMOVE)');
  };

  /**
   * See: SFTP events (RMDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  // eslint-disable-next-line class-methods-use-this
  public rmDirHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP remove directory (SSH_FXP_RMDIR)');
  };

  /**
   * See: SFTP events (REALPATH)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Canonicalizing the Server-Side Path Name
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.11
   */
  public realPathHandler = (reqId: number, relativePath: string): void => {
    logger.verbose(
      'Request: SFTP canonicalize path (SSH_FXP_REALPATH)',
      { reqId, relativePath },
    );
    const resolvedPath = path.resolve('/', relativePath);
    this.permanentFileSystem.getItemAttributes(resolvedPath)
      .then((attrs) => {
        const fileEntry = generateFileEntry(
          resolvedPath,
          attrs,
        );
        const names = [fileEntry];
        logger.verbose(
          'Response: Name',
          { reqId, names },
        );
        this.sftpConnection.name(reqId, names);
      })
      .catch(() => {
        logger.verbose(
          'Response: Status (EOF)',
          {
            reqId,
            code: SFTP_STATUS_CODE.NO_SUCH_FILE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
      });
  };

  /**
   * See: SFTP events (READLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic Links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  // eslint-disable-next-line class-methods-use-this
  public readLinkHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP read link (SSH_FXP_READLINK)');
  };

  /**
   * See: SFTP events (SETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public setStatHandler = (
    reqId: number,
    filePath: string,
    attrs: Attributes,
  ): void => {
    logger.verbose(
      'Request: SFTP set file attributes request (SSH_FXP_SETSTAT)',
      { reqId, filePath, attrs },
    );
    logger.verbose(
      'Response: Status (OK)',
      {
        reqId,
        code: SFTP_STATUS_CODE.OK,
      },
    );
    this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
  };

  /**
   * See: SFTP events (MKDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public mkDirHandler = (
    reqId: number,
    dirPath: string,
    attrs: Attributes,
  ): void => {
    logger.verbose(
      'Request: SFTP create directory (SSH_FXP_MKDIR)',
      { reqId, dirPath, attrs },
    );
    this.permanentFileSystem.makeDirectory(dirPath)
      .then(() => {
        logger.verbose('Response: Status (OK)', {
          reqId,
          code: SFTP_STATUS_CODE.OK,
        });
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
      })
      .catch(() => {
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      });
  };

  /**
   * See: SFTP events (RENAME)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming FIles
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  // eslint-disable-next-line class-methods-use-this
  public renameHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP file rename (SSH_FXP_RENAME)');
  };

  /**
   * See: SFTP events (SYMLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  // eslint-disable-next-line class-methods-use-this
  public symLinkHandler = (): void => {
    logger.error('UNIMPLEMENTED Request: SFTP create symlink (SSH_FXP_SYMLINK)');
  };

  private readonly genericStatHandler = (reqId: number, itemPath: Buffer): void => {
    this.permanentFileSystem.getItemAttributes(itemPath.toString())
      .then((attrs) => {
        logger.verbose(
          'Response: Attrs',
          { reqId, attrs },
        );
        this.sftpConnection.attrs(
          reqId,
          attrs,
        );
      })
      .catch(() => {
        logger.verbose(
          'Response: Status (NO_SUCH_FILE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.NO_SUCH_FILE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
      });
  };

  private readonly openExistingFileHandler = (
    reqId: number,
    filePath: string,
    flags: number,
  ): void => {
    const handle = generateHandle();
    const flagsString = ssh2.utils.sftp.flagsToString(flags);
    this.permanentFileSystem.loadFile(filePath)
      .then((file) => {
        // These flags are explained in the NodeJS fs documentation:
        // https://nodejs.org/api/fs.html#file-system-flags
        switch (flagsString) {
          case 'r': // read
            this.openFiles.set(handle, file);
            logger.verbose(
              'Response: Handle',
              { reqId, handle },
            );
            this.sftpConnection.handle(
              reqId,
              Buffer.from(handle),
            );
            break;
          // We do not currently allow anybody to edit an existing record in any way
          case 'r+': // read and write
          case 'w': // write
          case 'w+': // write and read
          case 'a': // append
          case 'a+': // append and read
            logger.verbose(
              'Response: Status (PERMISSION_DENIED)',
              {
                reqId,
                code: SFTP_STATUS_CODE.PERMISSION_DENIED,
              },
            );
            this.sftpConnection.status(reqId, SFTP_STATUS_CODE.PERMISSION_DENIED);
            break;
          // These codes all require the file NOT to exist
          case 'wx': // write (file must not exist)
          case 'xw': // write (file must not exist)
          case 'xw+': // write and read (file must not exist)
          case 'ax': // append (file must not exist)
          case 'xa': // append (file must not exist)
          case 'ax+': // append and write (file must not exist)
          case 'xa+': // append and write (file must not exist)
          default:
            logger.verbose(
              'Response: Status (FILE_ALREADY_EXISTS)',
              {
                reqId,
                code: SFTP_STATUS_CODE.FILE_ALREADY_EXISTS,
              },
            );
            this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FILE_ALREADY_EXISTS);
            break;
        }
      })
      .catch(() => {
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.FAILURE);
      });
  };

  private readonly openNewFileHandler = (
    reqId: number,
    filePath: string,
    flags: number,
  ): void => {
    const handle = generateHandle();
    const flagsString = ssh2.utils.sftp.flagsToString(flags);
    const parentPath = path.dirname(filePath);
    this.permanentFileSystem.loadDirectory(parentPath)
      .then(() => {
        // These flags are explained in the NodeJS fs documentation:
        // https://nodejs.org/api/fs.html#file-system-flags
        switch (flagsString) {
          case 'w': // write
          case 'wx': // write (file must not exist)
          case 'xw': // write (file must not exist)
          case 'w+': // write and read
          case 'xw+': // write and read (file must not exist)
          case 'ax': // append (file must not exist)
          case 'xa': // append (file must not exist)
          case 'a+': // append and read
          case 'ax+': // append and read (file must not exist)
          case 'xa+': // append and read (file must not exist)
          case 'a': // append
          {
            const temporaryFile = tmp.fileSync();
            this.openTemporaryFiles.set(handle, {
              ...temporaryFile,
              path: filePath,
            });
            logger.verbose(
              'Response: Handle',
              { reqId, handle },
            );
            this.sftpConnection.handle(
              reqId,
              Buffer.from(handle),
            );
            break;
          }
          case 'r+': // read and write (error if doesn't exist)
          case 'r': // read
          default:
            logger.verbose(
              'Response: Status (NO_SUCH_FILE)',
              {
                reqId,
                code: SFTP_STATUS_CODE.NO_SUCH_FILE,
              },
            );
            this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
            break;
        }
      })
      .catch(() => {
        logger.verbose(
          'Response: Status (NO_SUCH_PATH)',
          {
            reqId,
            code: SFTP_STATUS_CODE.NO_SUCH_PATH,
          },
        );
        this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_PATH);
      });
  };
}
