import { ArchiveRecordType, Status } from "@permanentorg/sdk";
import { createTestFile } from "./createTestFile";
import type { ArchiveRecord, File } from "@permanentorg/sdk";

interface TestArchiveRecordOverrides {
	id?: number;
	fileSystemId?: number;
	displayDate?: Date | null;
	type?: ArchiveRecordType;
	displayName?: string;
	files?: File[];
	fileSystemCompatibleName?: string;
	status?: Status;
	createdAt?: Date;
	updatedAt?: Date;
}

export const createTestArchiveRecord = (
	overrides: TestArchiveRecordOverrides = {},
): ArchiveRecord => ({
	id: overrides.id ?? 1,
	fileSystemId: overrides.fileSystemId ?? 1,
	displayDate: overrides.displayDate ?? null,
	type: overrides.type ?? ArchiveRecordType.Unknown,
	displayName: overrides.displayName ?? "Test Record",
	files: overrides.files ?? [createTestFile()],
	fileSystemCompatibleName: overrides.fileSystemCompatibleName ?? "test-record",
	status: overrides.status ?? Status.Ok,
	createdAt: overrides.createdAt ?? new Date("2024-01-15T12:00:00Z"),
	updatedAt: overrides.updatedAt ?? new Date("2024-01-15T12:00:00Z"),
});
