import { constants } from "fs";
import { access } from "fs/promises";

export async function checkFileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}
