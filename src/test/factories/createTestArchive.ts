import type { Archive } from "@permanentorg/sdk";

interface TestArchiveOverrides {
	id?: number;
	slug?: string;
	name?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export const createTestArchive = (
	overrides: TestArchiveOverrides = {},
): Archive => ({
	id: overrides.id ?? 1,
	slug: overrides.slug ?? "test-archive",
	name: overrides.name ?? "Test Archive",
	createdAt: overrides.createdAt ?? new Date("2024-01-15T12:00:00Z"),
	updatedAt: overrides.updatedAt ?? new Date("2024-01-15T12:00:00Z"),
});
