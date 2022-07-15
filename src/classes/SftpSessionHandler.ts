import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getArchives } from '@permanentorg/sdk';
import ssh2 from 'ssh2';
import { logger } from '../logger';
import type {
  Attributes,
  FileEntry,
  SFTPWrapper,
} from 'ssh2';
import type { Archive } from '@permanentorg/sdk';

const getFileType = (filePath: string): number => {
  // TODO: this is not a real rule -- directories can have extensions and files don't have to have them.
  if (filePath.includes('.')) {
    return fs.constants.S_IFREG;
  }
  return fs.constants.S_IFDIR;
};

const SFTP_STATUS_CODE = ssh2.utils.sftp.STATUS_CODE;

const isDirectoryMode = (mode: number): boolean => (mode & fs.constants.S_IFMT) == fs.constants.S_IFDIR;

const generateDefaultMode = (baseType: number): number => (
  baseType
  | fs.constants.S_IRWXU // Read, write, execute for user
  | fs.constants.S_IRWXG // Read, write, execute for group
  | fs.constants.S_IRWXO // Read, write, execute for other
);

const generateDefaultAttributes = (fileType: number): Attributes => ({
  mode: generateDefaultMode(fileType),
  uid: 0,
  gid: 0,
  size: 0,
  atime: 0,
  mtime: 0,
});

const getFilename = (filePath: string): string => {
  return filePath;
};

const getLongname = (
  filename: string,
  attributes: Attributes,
  owner = 'nobody',
  group = 'nogroup',
): string => {
  const directoryFlag = isDirectoryMode(attributes.mode) ? 'd' : '-';
  return `${directoryFlag}rwxrwxrwx 1 ${owner} ${group} 3 Dec 8 2009 ${filename}`;
};

const generateFileEntry = (
  filePath: string,
  attributes: Attributes,
): FileEntry => ({
  filename: filePath,
  longname: getLongname(
    getFilename(filePath),
    attributes,
  ),
  attrs: attributes,
});

const generateHandle = (): string => uuidv4();

const loadArchives = async (authToken: string): Promise<FileEntry[]> => {
  const archives = await getArchives({
    bearerToken: authToken,
  });
  return archives.map((archive: Archive) => {
    const archiveDirectoryPath = `/archives/${archive.name} (${archive.id})`;
    return generateFileEntry(
      archiveDirectoryPath,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    );
  });
};

const loadArchive = async (authToken: string, archiveName: string): Promise<FileEntry[]> => {
  return [
    generateFileEntry(
      `${archiveName}/MyFiles`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ),
    generateFileEntry(
      `${archiveName}/Shares`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ),
    generateFileEntry(
      `${archiveName}/Public`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ),
    generateFileEntry(
      `${archiveName}/Apps`,
      generateDefaultAttributes(fs.constants.S_IFDIR),
    ),
  ];
};

const loadPath = async (requestedPath: string, authToken: string): Promise<FileEntry[]> => {
  if (requestedPath === '/') {
    return [
      generateFileEntry(
        '/archives',
        generateDefaultAttributes(fs.constants.S_IFDIR),
      ),
    ];
  } else if (requestedPath === '/archives') {
    return loadArchives(authToken);
  } else if (requestedPath.includes('/archives') && requestedPath.split('/').length == 3) {
    return loadArchive(
      authToken,
      requestedPath,
    );
  }
  return [];
};

export class SftpSessionHandler {
  private readonly authToken: string;

  private readonly sftpConnection: SFTPWrapper;

  private readonly openDirectories: Map<string, FileEntry[]> = new Map();

  private readonly openFiles: Map<string, Buffer> = new Map();

  public constructor(
    sftpConnection: SFTPWrapper,
    authToken: string,
  ) {
    this.sftpConnection = sftpConnection;
    this.authToken = authToken;
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
  public readHandler = (): void => {
    logger.verbose('SFTP read file request (SSH_FXP_READ)');
  };

  /**
   * See: SFTP events (WRITE)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Reading and Writing
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.4
   */
  public writeHandler = (): void => {
    logger.verbose('SFTP write file request (SSH_FXP_WRITE)');
  };

  /**
   * See: SFTP events (FSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
  public fstatHandler = (): void => {
    logger.verbose('SFTP read open file statistics request (SSH_FXP_FSTAT)');
  };

  /**
   * See: SFTP events (FSETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
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
    loadPath(dirPath, this.authToken)
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
        logger.debug('Failed to load path', { reqId, dirPath }, reason);
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
  public lstatHandler = (): void => {
    logger.verbose('SFTP read file statistics without following symbolic links request (SSH_FXP_LSTAT)');
  };

  /**
   * See: SFTP events (STAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Retrieving File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.8
   */
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
  public removeHandler = (): void => {
    logger.verbose('SFTP remove file request (SSH_FXP_REMOVE)');
  };

  /**
   * See: SFTP events (RMDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
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
  public readLinkHandler = (): void => {
    logger.verbose('SFTP read link request (SSH_FXP_READLINK)');
  };

  /**
   * See: SFTP events (SETSTAT)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Setting File Attributes
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.9
   */
  public setStatHandler = (): void => {
    logger.verbose('SFTP set file attributes request (SSH_FXP_SETSTAT)');
  };

  /**
   * See: SFTP events (MKDIR)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Creating and Deleting Directories
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.6
   */
  public mkDirHandler = (): void => {
    logger.verbose('SFTP create directory request (SSH_FXP_MKDIR)');
  };

  /**
   * See: SFTP events (RENAME)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Removing and Renaming FIles
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.5
   */
  public renameHandler = (): void => {
    logger.verbose('SFTP file rename request (SSH_FXP_RENAME)');
  };

  /**
   * See: SFTP events (SYMLINK)
   * https://github.com/mscdex/ssh2/blob/master/SFTP.md
   * Also: Dealing with Symbolic links
   * https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02#section-6.10
   */
  public symLinkHandler = (): void => {
    logger.verbose('SFTP create symlink request (SSH_FXP_SYMLINK)');
  };
}
