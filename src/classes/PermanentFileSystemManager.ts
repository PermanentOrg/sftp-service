import { logger } from "../logger";
import { PermanentFileSystem } from "./PermanentFileSystem";
import type { AuthTokenManager } from "./AuthTokenManager";

const FILE_CLEANUP_TIMEOUT_MS = 300000; // 5 minutes

export class PermanentFileSystemManager {
	private readonly permanentFileSystems = new Map<
		string,
		PermanentFileSystem
	>();

	private readonly deletionTimeouts = new Map<string, NodeJS.Timeout>();

	public getCurrentPermanentFileSystemForUser(
		user: string,
		authTokenManager: AuthTokenManager,
	): PermanentFileSystem {
		logger.silly("Get permanent file system for user", { user });
		this.resetDeletionTimeout(user);
		const existingFileSystem = this.permanentFileSystems.get(user);
		if (existingFileSystem !== undefined) {
			return existingFileSystem;
		}
		const permanentFileSystem = new PermanentFileSystem(authTokenManager);
		this.permanentFileSystems.set(user, permanentFileSystem);
		return permanentFileSystem;
	}

	public deletePermanentFileSystemForUser(user: string): void {
		this.permanentFileSystems.delete(user);
	}

	private resetDeletionTimeout(user: string): void {
		const existingTimeout = this.deletionTimeouts.get(user);
		if (existingTimeout !== undefined) {
			clearTimeout(existingTimeout);
		}
		this.deletionTimeouts.set(
			user,
			setTimeout(() => {
				logger.silly("Delete permanent file system for user", { user });
				this.deletePermanentFileSystemForUser(user);
			}, FILE_CLEANUP_TIMEOUT_MS),
		);
	}
}
