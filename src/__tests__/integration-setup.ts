import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export default async (): Promise<void> => {
	const testHostKeyPath = join(tmpdir(), "test_host_key");

	const mockHostKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAuNiN+1i2w0z2ZG1P1mY6nxP9qM8Z6B0q3Qq4Y8n1F9w1h2C7P9q
-----END OPENSSH PRIVATE KEY-----`;

	writeFileSync(testHostKeyPath, mockHostKey);

	process.env.SSH_HOST_KEY_PATH = testHostKeyPath;
};