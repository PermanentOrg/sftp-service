import fs from "fs";

export const generateDefaultMode = (baseType: number): number =>
	baseType |
	fs.constants.S_IRWXU | // Read, write, execute for user
	fs.constants.S_IRWXG | // Read, write, execute for group
	fs.constants.S_IRWXO; // Read, write, execute for other
