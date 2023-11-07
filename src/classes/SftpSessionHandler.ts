import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import ssh2 from 'ssh2';
import { logger } from '../logger';
import { generateFileEntry } from '../utils';
import { MissingTemporaryFileError } from '../errors';
import { PermanentFileSystem } from './PermanentFileSystem';
import { TemporaryFileManager } from './TemporaryFileManager';
import type { AuthTokenManager } from './AuthTokenManager';
import type { PermanentFileSystemManager } from './PermanentFileSystemManager';
import type { TemporaryFile } from './TemporaryFileManager';
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

enum ServerResourceType {
  Directory = 'directory',
  PermanentFile = 'permanentFile',
  TemporaryFile = 'temporaryFile',
}

interface GenericServerResource {
  virtualFilePath: string,
  resourceType: ServerResourceType,
}

interface DirectoryResource extends GenericServerResource {
  resourceType: ServerResourceType.Directory,
  fileEntries: FileEntry[],
  cursor: number,
}

interface PermanentFileResource extends GenericServerResource {
  resourceType: ServerResourceType.PermanentFile,
  file: File,
}

interface TemporaryFileResource extends GenericServerResource {
  resourceType: ServerResourceType.TemporaryFile,
}

type ServerResource = DirectoryResource | PermanentFileResource | TemporaryFileResource;

export class SftpSessionHandler {
  private readonly sftpConnection: SFTPWrapper;

  private readonly activeHandles = new Map<string, ServerResource>();

  private readonly temporaryFileManager = new TemporaryFileManager();

  private readonly permanentFileSystemManager: PermanentFileSystemManager;

  private readonly authTokenManager: AuthTokenManager;

  public constructor(
    sftpConnection: SFTPWrapper,
    authTokenManager: AuthTokenManager,
    permanentFileSystemManager: PermanentFileSystemManager,
  ) {
    this.sftpConnection = sftpConnection;
    this.authTokenManager = authTokenManager;
    this.permanentFileSystemManager = permanentFileSystemManager;
  }

  /**
   * See: SFTP events (OPEN)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public openHandler(
    reqId: number,
    filePath: string,
    flags: number,
    attrs: Attributes,
  ): void {
    logger.verbose(
      'Request: SFTP file open (SSH_FXP_OPEN)',
      {
        reqId,
        filePath,
        flags,
        attrs,
      },
    );
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.getItemType(filePath)
        .then((fileType) => {
          switch (fileType) {
            case fs.constants.S_IFDIR:
              logger.verbose(
                'Response: Status (NO_SUCH_FILE)',
                {
                  reqId,
                  code: SFTP_STATUS_CODE.NO_SUCH_FILE,
                },
              );
              this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
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
        }).catch((err: unknown) => {
          logger.debug(err);
          this.openNewFileHandler(
            reqId,
            filePath,
            flags,
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (READ)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public readHandler(
    reqId: number,
    handle: Buffer,
    offset: number,
    length: number,
  ): void {
    logger.verbose(
      'Request: SFTP read file (SSH_FXP_READ)',
      {
        reqId,
        handle: handle.toString(),
        offset,
        length,
      },
    );
    const serverResource = this.activeHandles.get(handle.toString());
    if (serverResource === undefined) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'There is no server resource associated with this handle.',
      );
      return;
    }
    if (serverResource.resourceType !== ServerResourceType.PermanentFile) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'This handle does not refer to a readable file.',
      );
      return;
    }

    const { file } = serverResource;
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
        logger.silly(
          'Fetch response status code...',
          { statusCode: response.status },
        );
        switch (response.status) {
          case 206:
          case 200: {
            const data = await response.buffer();
            logger.verbose('Response: Data', { reqId });
            logger.silly('Sent data...', { data });
            this.sftpConnection.data(
              reqId,
              data,
            );
            break;
          }
          case 403:
            logger.verbose(
              'Response: Status (PERMISSION_DENIED)',
              {
                reqId,
                code: SFTP_STATUS_CODE.PERMISSION_DENIED,
              },
            );
            this.sftpConnection.status(
              reqId,
              SFTP_STATUS_CODE.PERMISSION_DENIED,
              'Received 403 (Forbidden) response when attempting to access the download URL associated with this file.',
            );
            break;
          default:
            logger.verbose(
              'Response: Status (FAILURE)',
              {
                reqId,
                code: SFTP_STATUS_CODE.FAILURE,
              },
            );
            this.sftpConnection.status(
              reqId,
              SFTP_STATUS_CODE.FAILURE,
              `Received an unhandled response type (${response.status}) when attempting to access the download URL associated with this file.`,
            );
            break;
        }
      })
      .catch((err: unknown) => {
        logger.warn('Failed to read data', {
          reqId,
          handle,
          offset,
          length,
        });
        logger.debug(err);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to fetch the download URL associated with this file.',
        );
      });
  }

  /**
   * See: SFTP events (WRITE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public writeHandler(
    reqId: number,
    handle: Buffer,
    offset: number,
    data: Buffer,
  ): void {
    logger.verbose(
      'Request: SFTP write file (SSH_FXP_WRITE)',
      {
        reqId,
        handle: handle.toString(),
        offset,
      },
    );
    logger.silly(
      'Request Data:',
      { reqId, data },
    );
    const serverResource = this.activeHandles.get(handle.toString());
    if (serverResource === undefined) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'There is no server resource associated with this handle.',
      );
      return;
    }
    if (serverResource.resourceType !== ServerResourceType.TemporaryFile) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'This handle does not refer to a writable file.',
      );
      return;
    }
    const { virtualFilePath } = serverResource;
    if (offset + data.length > 5368709120) { // 5 GB
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
          path: virtualFilePath,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'You cannot upload files larger then 5 GB.',
      );
      return;
    }
    this.temporaryFileManager.getTemporaryFile(virtualFilePath).then((temporaryFile) => {
      fs.write(
        temporaryFile.fd,
        data,
        0,
        data.length,
        offset,
        (err, written, buffer) => {
          if (err) {
            logger.verbose(
              'Response: Status (FAILURE)',
              {
                reqId,
                code: SFTP_STATUS_CODE.FAILURE,
                path: temporaryFile.virtualPath,
              },
            );
            this.sftpConnection.status(
              reqId,
              SFTP_STATUS_CODE.FAILURE,
              'An error occurred when attempting to write to the temporary file associated with this handle.',
            );
            return;
          }
          logger.debug('Successful Write.', { reqId, handle, written });
          logger.silly('Written Data:', { buffer });
          logger.verbose(
            'Response: Status (OK)',
            {
              reqId,
              code: SFTP_STATUS_CODE.OK,
              path: temporaryFile.virtualPath,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
        },
      );
    }).catch((err) => {
      if (err instanceof MissingTemporaryFileError) {
        logger.debug('There is no open temporary file associated with this handle', { reqId, handle });
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'The temporary file associated with this handle could not be accessed.',
        );
        return;
      }
      logger.debug('Something went wrong when accessing the temporary file', { reqId, handle });
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'Something went wrong when accessing the temporary file associated with this handle.',
      );
    });
  }

  /**
   * See: SFTP events (FSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public fstatHandler(
    reqId: number,
    handle: Buffer,
  ): void {
    logger.verbose(
      'Request: SFTP read open file statistics (SSH_FXP_FSTAT)',
      { reqId, handle },
    );
    const serverResource = this.activeHandles.get(handle.toString());
    if (serverResource === undefined) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'There is no server resource associated with this handle.',
      );
      return;
    }
    if (serverResource.resourceType !== ServerResourceType.PermanentFile) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'This handle does not refer to a readable file.',
      );
      return;
    }

    const { virtualFilePath } = serverResource;
    this.genericStatHandler(reqId, virtualFilePath);
  }

  /**
   * See: SFTP events (FSETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public fsetStatHandler(reqId: number, handle: Buffer, attrs: Attributes): void {
    logger.error('UNIMPLEMENTED Request: SFTP write open file statistics (SSH_FXP_FSETSTAT)');
    logger.verbose(
      'Response: Status (FAILURE)',
      {
        reqId,
        code: SFTP_STATUS_CODE.FAILURE,
        handle,
        attrs,
      },
    );
    this.sftpConnection.status(
      reqId,
      SFTP_STATUS_CODE.FAILURE,
      'Setting file attributes is not supported by Permanent.org.',
    );
  }

  /**
   * See: SFTP events (CLOSE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Opening, Creating, and Closing Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.3
   */
  public closeHandler(reqId: number, handle: Buffer): void {
    logger.verbose(
      'Request: SFTP close file (SSH_FXP_CLOSE)',
      {
        reqId,
        handle: handle.toString(),
      },
    );
    const serverResource = this.activeHandles.get(handle.toString());
    if (serverResource === undefined) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'There is no server resource associated with this handle.',
      );
      return;
    }
    if (serverResource.resourceType === ServerResourceType.Directory) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'This handle does not refer to a file.',
      );
      return;
    }
    if (serverResource.resourceType === ServerResourceType.PermanentFile) {
      this.activeHandles.delete(handle.toString());
      logger.verbose(
        'Response: Status (OK)',
        {
          reqId,
          code: SFTP_STATUS_CODE.OK,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
      return;
    }
    const { virtualFilePath } = serverResource;
    (async () => {
      let temporaryFile: TemporaryFile;
      let fileSize: number;
      let permanentFileSystem: PermanentFileSystem;

      try {
        temporaryFile = await this.temporaryFileManager.getTemporaryFile(virtualFilePath);
      } catch (err: unknown) {
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
            path: virtualFilePath,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to access the temporary file associated with this handle.',
        );
        return;
      }

      try {
        const { size } = await fs.promises.stat(temporaryFile.name);
        fileSize = size;
      } catch (err: unknown) {
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
            path: temporaryFile.virtualPath,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to load the file statistics for the temporary file associated with this handle.',
        );
        return;
      }

      try {
        permanentFileSystem = await this.getCurrentPermanentFileSystem();
      } catch (err: unknown) {
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
            path: temporaryFile.virtualPath,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to access the Permanent File System.',
        );
        return;
      }

      try {
        await permanentFileSystem.createFile(
          temporaryFile.virtualPath,
          fs.createReadStream(temporaryFile.name),
          fileSize,
        );
      } catch (err: unknown) {
        logger.debug(err);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
            path: temporaryFile.virtualPath,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to register this file on Permanent.org.',
        );
        return;
      }

      try {
        await this.temporaryFileManager.deleteTemporaryFile(virtualFilePath);
        this.activeHandles.delete(handle.toString());
      } catch (err: unknown) {
        logger.debug(err);
        logger.verbose(
          'Response: Status (FAILURE)',
          {
            reqId,
            code: SFTP_STATUS_CODE.FAILURE,
            path: virtualFilePath,
          },
        );
        this.sftpConnection.status(
          reqId,
          SFTP_STATUS_CODE.FAILURE,
          'An error occurred when attempting to delete the temporary file associated with this handle.',
        );
        return;
      }
      logger.verbose(
        'Response: Status (OK)',
        {
          reqId,
          code: SFTP_STATUS_CODE.OK,
          path: virtualFilePath,
        },
      );
      this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
    })().catch((err: unknown) => {
      logger.debug(err);
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
          path: virtualFilePath,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'An error occurred when attempting to close the file associated with this handle.',
      );
    });
  }

  /**
   * See: SFTP events (OPENDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public openDirHandler(reqId: number, dirPath: string): void {
    logger.verbose(
      'SFTP open directory request (SSH_FXP_OPENDIR)',
      { reqId, dirPath },
    );
    const handle = generateHandle();
    logger.debug(`Opening directory ${dirPath}:`, handle);
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.loadDirectory(dirPath)
        .then((fileEntries) => {
          logger.debug('Contents:', fileEntries);
          const directoryResource = {
            virtualFilePath: dirPath,
            resourceType: ServerResourceType.Directory as const,
            fileEntries,
            cursor: 0,
          };
          this.activeHandles.set(handle, directoryResource);
          logger.verbose(
            'Response: Handle',
            {
              reqId,
              handle,
              path: dirPath,
            },
          );
          this.sftpConnection.handle(
            reqId,
            Buffer.from(handle),
          );
        })
        .catch((err: unknown) => {
          logger.warn(err);
          logger.warn('Failed to load path', { reqId, dirPath });
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
              path: dirPath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.FAILURE,
            'An error occurred when attempting to load this directory from Permanent.org.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (READDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Scanning Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.7
   */
  public readDirHandler(reqId: number, handle: Buffer): void {
    logger.verbose(
      'Request: SFTP read directory (SSH_FXP_READDIR)',
      {
        reqId,
        handle: handle.toString(),
      },
    );
    const serverResource = this.activeHandles.get(handle.toString());
    if (serverResource === undefined) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'There is no server resource associated with this handle.',
      );
      return;
    }
    if (serverResource.resourceType !== ServerResourceType.Directory) {
      logger.verbose(
        'Response: Status (FAILURE)',
        {
          reqId,
          code: SFTP_STATUS_CODE.FAILURE,
        },
      );
      this.sftpConnection.status(
        reqId,
        SFTP_STATUS_CODE.FAILURE,
        'This handle does not refer to an open directory.',
      );
      return;
    }

    const {
      fileEntries,
      cursor,
    } = serverResource;
    if (cursor >= fileEntries.length) {
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
    logger.verbose('Response: Name', { reqId, fileEntries });
    this.activeHandles.set(handle.toString(), {
      ...serverResource,
      cursor: fileEntries.length,
    });
    this.sftpConnection.name(reqId, fileEntries);
  }

  /**
   * See: SFTP events (LSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public lstatHandler(
    reqId: number,
    itemPath: string,
  ): void {
    logger.verbose(
      'Request: SFTP read file statistics without following symbolic links (SSH_FXP_LSTAT)',
      { reqId, itemPath },
    );
    this.genericStatHandler(reqId, itemPath);
  }

  /**
   * See: SFTP events (STAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public statHandler(
    reqId: number,
    itemPath: string,
  ): void {
    logger.verbose(
      'Request: SFTP read file statistics following symbolic links (SSH_FXP_STAT)',
      { reqId, itemPath },
    );
    this.genericStatHandler(reqId, itemPath);
  }

  /**
   * See: SFTP events (REMOVE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming Files
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  public removeHandler(reqId: number, filePath: string): void {
    logger.verbose(
      'Request: SFTP remove file (SSH_FXP_REMOVE)',
      { reqId, filePath },
    );

    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.deleteFile(filePath)
        .then(() => {
          logger.verbose(
            'Response: Status (OK)',
            {
              reqId,
              code: SFTP_STATUS_CODE.OK,
              path: filePath,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
              path: filePath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.FAILURE,
            'An error occurred when attempting to delete this file on Permanent.org.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (RMDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public rmDirHandler(reqId: number, directoryPath: string): void {
    logger.verbose(
      'Request: SFTP remove directory path (SSH_FXP_RMDIR)',
      { reqId, directoryPath },
    );

    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.deleteDirectory(directoryPath)
        .then(() => {
          logger.verbose(
            'Response: Status (OK)',
            {
              reqId,
              code: SFTP_STATUS_CODE.OK,
              path: directoryPath,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
              path: directoryPath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.FAILURE,
            'An error occurred when attempting to delete this directory on Permanent.org.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (REALPATH)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Canonicalizing the Server-Side Path Name
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.11
   */
  public realPathHandler(reqId: number, relativePath: string): void {
    logger.verbose(
      'Request: SFTP canonicalize path (SSH_FXP_REALPATH)',
      { reqId, relativePath },
    );
    const resolvedPath = path.resolve('/', relativePath);
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.getItemAttributes(resolvedPath)
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
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (EOF)',
            {
              reqId,
              code: SFTP_STATUS_CODE.NO_SUCH_FILE,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (READLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic Links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  public readLinkHandler(reqId: number, linkPath: string): void {
    logger.error('UNIMPLEMENTED Request: SFTP read link (SSH_FXP_READLINK)');
    logger.verbose(
      'Response: Status (FAILURE)',
      {
        reqId,
        code: SFTP_STATUS_CODE.FAILURE,
        linkPath,
      },
    );
    this.sftpConnection.status(
      reqId,
      SFTP_STATUS_CODE.FAILURE,
      'Symlinks are not supported by Permanent.org.',
    );
  }

  /**
   * See: SFTP events (SETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public setStatHandler(
    reqId: number,
    filePath: string,
    attrs: Attributes,
  ): void {
    logger.verbose(
      'Request: SFTP set file attributes request (SSH_FXP_SETSTAT)',
      {
        reqId,
        path: filePath,
        attrs,
      },
    );
    logger.verbose(
      'Response: Status (OK)',
      {
        reqId,
        code: SFTP_STATUS_CODE.OK,
        path: filePath,
      },
    );
    this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
  }

  /**
   * See: SFTP events (MKDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public mkDirHandler(
    reqId: number,
    dirPath: string,
    attrs: Attributes,
  ): void {
    logger.verbose(
      'Request: SFTP create directory (SSH_FXP_MKDIR)',
      {
        reqId,
        path: dirPath,
        attrs,
      },
    );
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.createDirectory(dirPath)
        .then(() => {
          logger.verbose('Response: Status (OK)', {
            reqId,
            code: SFTP_STATUS_CODE.OK,
            path: dirPath,
          });
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.OK);
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
              path: dirPath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.FAILURE,
            'An error occurred when attempting to create this directory on Permanent.org.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  /**
   * See: SFTP events (RENAME)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming FIles
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  public renameHandler(reqId: number, itemPath: string): void {
    logger.error('UNIMPLEMENTED Request: SFTP file rename (SSH_FXP_RENAME)');
    logger.verbose(
      'Response: Status (FAILURE)',
      {
        reqId,
        code: SFTP_STATUS_CODE.FAILURE,
        itemPath,
      },
    );
    this.sftpConnection.status(
      reqId,
      SFTP_STATUS_CODE.FAILURE,
      'Renaming is not supported by this sftp service.',
    );
  }

  /**
   * See: SFTP events (SYMLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  public symLinkHandler(reqId: number, linkPath: string, targetPath: string): void {
    logger.error('UNIMPLEMENTED Request: SFTP create symlink (SSH_FXP_SYMLINK)');
    logger.verbose(
      'Response: Status (FAILURE)',
      {
        reqId,
        code: SFTP_STATUS_CODE.FAILURE,
        linkPath,
        targetPath,
      },
    );
    this.sftpConnection.status(
      reqId,
      SFTP_STATUS_CODE.FAILURE,
      'Symlinks are not supported by Permanent.org.',
    );
  }

  private genericStatHandler(reqId: number, itemPath: string): void {
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.getItemAttributes(itemPath)
        .then((attrs) => {
          logger.verbose(
            'Response: Attrs',
            {
              reqId,
              attrs,
              path: itemPath.toString(),
            },
          );
          this.sftpConnection.attrs(
            reqId,
            attrs,
          );
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (NO_SUCH_FILE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.NO_SUCH_FILE,
              path: itemPath,
            },
          );
          this.sftpConnection.status(reqId, SFTP_STATUS_CODE.NO_SUCH_FILE);
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  private openExistingFileHandler(
    reqId: number,
    filePath: string,
    flags: number,
  ): void {
    const handle = generateHandle();
    const flagsString = ssh2.utils.sftp.flagsToString(flags);

    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.loadFile(filePath, true)
        .then((file) => {
          // These flags are explained in the NodeJS fs documentation:
          // https://nodejs.org/api/fs.html#file-system-flags
          switch (flagsString) {
            case 'r': { // read
              const permanentFileResource = {
                resourceType: ServerResourceType.PermanentFile as const,
                virtualFilePath: filePath,
                file,
              };
              this.activeHandles.set(handle, permanentFileResource);
              logger.verbose(
                'Response: Handle',
                {
                  reqId,
                  handle,
                  path: filePath,
                },
              );
              this.sftpConnection.handle(
                reqId,
                Buffer.from(handle),
              );
              break;
            }
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
                  path: filePath,
                },
              );
              this.sftpConnection.status(
                reqId,
                SFTP_STATUS_CODE.PERMISSION_DENIED,
                'This file already exists on Permanent.org. Editing exiting files is not supported.',
              );
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
                'Response: Status (FAILURE)',
                {
                  reqId,
                  code: SFTP_STATUS_CODE.FAILURE,
                  path: filePath,
                },
              );
              this.sftpConnection.status(
                reqId,
                SFTP_STATUS_CODE.FAILURE,
                `This file already exists on Permanent.org, but the specified write mode (${flagsString ?? 'null'}) requires the file to not exist.`,
              );
              break;
          }
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (FAILURE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.FAILURE,
              path: filePath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.FAILURE,
            'An error occurred when attempting to load this file from Permanent.org.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  private openNewFileHandler(
    reqId: number,
    filePath: string,
    flags: number,
  ): void {
    const handle = generateHandle();
    const flagsString = ssh2.utils.sftp.flagsToString(flags);
    const parentPath = path.dirname(filePath);
    this.getCurrentPermanentFileSystem().then((permFileSystem: PermanentFileSystem) => {
      permFileSystem.loadDirectory(parentPath)
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
              this.temporaryFileManager.createTemporaryFile(filePath).then(() => {
                const temporaryFileResource = {
                  resourceType: ServerResourceType.TemporaryFile as const,
                  virtualFilePath: filePath,
                };
                this.activeHandles.set(handle, temporaryFileResource);
                logger.verbose(
                  'Response: Handle',
                  {
                    reqId,
                    handle,
                    path: filePath,
                  },
                );
                this.sftpConnection.handle(
                  reqId,
                  Buffer.from(handle),
                );
              }).catch((err) => {
                logger.debug(err);
                logger.verbose(
                  'Response: Status (FAILURE)',
                  {
                    reqId,
                    code: SFTP_STATUS_CODE.FAILURE,
                  },
                );
                this.sftpConnection.status(
                  reqId,
                  SFTP_STATUS_CODE.FAILURE,
                  'An error occurred when attempting to create the file in temporary storage.',
                );
              });
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
                  path: filePath,
                },
              );
              this.sftpConnection.status(
                reqId,
                SFTP_STATUS_CODE.NO_SUCH_FILE,
                'The specified file does not exist.',
              );
              break;
          }
        })
        .catch((err: unknown) => {
          logger.debug(err);
          logger.verbose(
            'Response: Status (NO_SUCH_FILE)',
            {
              reqId,
              code: SFTP_STATUS_CODE.NO_SUCH_FILE,
              path: filePath,
            },
          );
          this.sftpConnection.status(
            reqId,
            SFTP_STATUS_CODE.NO_SUCH_FILE,
            'The specified parent directory does not exist.',
          );
        });
    }).catch((fileSysErr) => {
      logger.error(`Error loading file permanent file system ${fileSysErr}`);
    });
  }

  private async getCurrentPermanentFileSystem(): Promise<PermanentFileSystem> {
    return this.permanentFileSystemManager
      .getCurrentPermanentFileSystemForUser(
        this.authTokenManager.username,
        await this.authTokenManager.getAuthToken(),
      );
  }
}
