import { assertProductionSafeEnv } from "./src/lib/production-guard";

export async function register() {
  assertProductionSafeEnv(process.env);
}
