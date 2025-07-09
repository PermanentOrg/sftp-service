import fs from "node:fs";
import tmp from "tmp";
import { logger } from "../logger";
import { MissingTemporaryFileError } from "../errors";
import type { FileResult } from "tmp";

export interface TemporaryFile extends FileResult {
	virtualPath: string;
}

export class TemporaryFileManager {
	private readonly openTemporaryFiles = new Map<string, TemporaryFile>();

	private readonly temporaryFileCleanupTimeouts = new Map<
		string,
		NodeJS.Timeout
	>();

	private static async verifyPathExistsOnDisk(
		localPath: string,
	): Promise<boolean> {
		return new Promise((resolve) => {
			fs.access(localPath, (err) => {
				if (err !== null) {
					resolve(false);
				}
				resolve(true);
			});
		});
	}

	public async getTemporaryFile(virtualPath: string): Promise<TemporaryFile> {
		const temporaryFile = this.openTemporaryFiles.get(virtualPath);
		if (temporaryFile === undefined) {
			throw new MissingTemporaryFileError(
				"Attempted to access a temporary file that does not exist in memory.",
			);
		}
		if (
			!(await TemporaryFileManager.verifyPathExistsOnDisk(temporaryFile.name))
		) {
			throw new MissingTemporaryFileError(
				"Attempted to access a temporary file that does not exist on disk.",
			);
		}
		this.refreshCleanupTimeout(virtualPath);
		return temporaryFile;
	}

	public async deleteTemporaryFile(virtualPath: string): Promise<void> {
		this.clearCleanupTimeout(virtualPath);
		const temporaryFile = await this.getTemporaryFile(virtualPath);
		temporaryFile.removeCallback();
	}

	public async createTemporaryFile(
		virtualPath: string,
	): Promise<TemporaryFile> {
		this.setCleanupTimeout(virtualPath);
		return new Promise<TemporaryFile>((resolve, reject) => {
			tmp.file((err, name, fd, removeCallback) => {
				if (err !== null) {
					reject(err);
				}
				const temporaryFile = {
					name,
					fd,
					removeCallback,
					virtualPath,
				};
				this.openTemporaryFiles.set(virtualPath, {
					...temporaryFile,
					virtualPath,
				});
				resolve(temporaryFile);
			});
		});
	}

	private refreshCleanupTimeout(virtualPath: string): void {
		this.clearCleanupTimeout(virtualPath);
		this.setCleanupTimeout(virtualPath);
	}

	private setCleanupTimeout(virtualPath: string): void {
		const timeout = setTimeout(
			() => {
				logger.info(
					`Deleting the temporary file associated with ${virtualPath} via cleanup timeout.`,
				);
				this.deleteTemporaryFile(virtualPath).catch((err: unknown) => {
					if (err instanceof MissingTemporaryFileError) {
						logger.info(
							`The temporary file associated with "${virtualPath}" does not exist.`,
						);
						return;
					}
					logger.info(err);
					logger.info(
						`Unable to delete temporary file associated with ${virtualPath}`,
					);
				});
			},
			86400000, // 24 hours
		);
		this.temporaryFileCleanupTimeouts.set(virtualPath, timeout);
	}

	private clearCleanupTimeout(virtualPath: string): void {
		clearTimeout(this.temporaryFileCleanupTimeouts.get(virtualPath));
	}
}
