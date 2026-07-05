import path from "node:path";
import type { StoreDriver } from "./driver";

export const DEFAULT_SQLITE_PATH = path.join(process.cwd(), ".data", "app.db");

/** Local durable driver on the built-in node:sqlite. */
export function createSqliteDriver(
  filePath: string = DEFAULT_SQLITE_PATH,
): StoreDriver {
  void filePath;
  throw new Error("not implemented");
}
