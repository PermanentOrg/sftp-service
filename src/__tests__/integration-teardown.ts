import { unlinkSync, existsSync } from "fs";

export default async (): Promise<void> => {
	const testHostKeyPath = process.env.SSH_HOST_KEY_PATH;

	if (testHostKeyPath && existsSync(testHostKeyPath)) {
		try {
			unlinkSync(testHostKeyPath);
		} catch (error) {
			console.warn(`Failed to clean up test host key: ${error}`);
		}
	}
};