// This error is called internally within the PermanentFileSystem
// when an permanent-scoped operation has been attempted on a path
// that is not of the correct permanent object type.
//
// If it is seen it is an indication of a logical flow error.
export class InvalidOperationForPathError extends Error {}
