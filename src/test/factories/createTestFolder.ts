import type { ArchiveRecord, Folder } from "@permanentorg/sdk";

interface TestFolderOverrides {
	id?: number;
	fileSystemId?: number;
	name?: string;
	size?: number;
	displayDate?: Date | null;
	fileSystemCompatibleName?: string;
	folders?: Folder[];
	archiveRecords?: ArchiveRecord[];
	createdAt?: Date;
	updatedAt?: Date;
}

export const createTestFolder = (
	overrides: TestFolderOverrides = {},
): Folder => ({
	id: overrides.id ?? 1,
	fileSystemId: overrides.fileSystemId ?? 1,
	name: overrides.name ?? "Test Folder",
	size: overrides.size ?? 4096,
	displayDate: overrides.displayDate ?? null,
	fileSystemCompatibleName: overrides.fileSystemCompatibleName ?? "test-folder",
	folders: overrides.folders ?? [],
	archiveRecords: overrides.archiveRecords ?? [],
	createdAt: overrides.createdAt ?? new Date("2024-01-15T12:00:00Z"),
	updatedAt: overrides.updatedAt ?? new Date("2024-01-15T12:00:00Z"),
});
