import { DerivativeType } from "@permanentorg/sdk";
import type { File } from "@permanentorg/sdk";

interface TestFileOverrides {
	id?: number;
	size?: number;
	contentType?: string;
	derivativeType?: DerivativeType;
	fileUrl?: string;
	downloadUrl?: string;
	checksum?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export const createTestFile = (overrides: TestFileOverrides = {}): File => ({
	id: overrides.id ?? 1,
	size: overrides.size ?? 1024,
	contentType: overrides.contentType ?? "application/octet-stream",
	derivativeType: overrides.derivativeType ?? DerivativeType.Original,
	fileUrl: overrides.fileUrl ?? "https://example.com/file",
	downloadUrl: overrides.downloadUrl ?? "https://example.com/download",
	checksum: overrides.checksum ?? "abc123",
	createdAt: overrides.createdAt ?? new Date("2024-01-15T12:00:00Z"),
	updatedAt: overrides.updatedAt ?? new Date("2024-01-15T12:00:00Z"),
});
