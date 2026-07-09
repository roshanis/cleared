type EnvLike = Record<string, string | undefined>;

export function assertProductionSafeEnv(env: EnvLike = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const demoFlagEnabled = env.DEMO_AUTH === "1" || env.DEMO_PUBLIC === "1";
  if (demoFlagEnabled && env.ALLOW_DEMO_DEPLOY !== "1") {
    throw new Error(
      "Production startup refused: DEMO_AUTH=1 or DEMO_PUBLIC=1 requires ALLOW_DEMO_DEPLOY=1. Set ALLOW_DEMO_DEPLOY=1 only for an intentional demo deployment, or unset DEMO_AUTH and DEMO_PUBLIC.",
    );
  }

  if (!env.AUTH_SECRET?.trim()) {
    throw new Error(
      "Production startup refused: AUTH_SECRET is required. Set AUTH_SECRET to a strong secret before deploying.",
    );
  }

  if (
    !env.DATABASE_URL?.trim() &&
    !env.POSTGRES_URL?.trim() &&
    env.ALLOW_DEMO_DEPLOY !== "1"
  ) {
    throw new Error(
      "Production startup refused: DATABASE_URL or POSTGRES_URL is required. Set DATABASE_URL or POSTGRES_URL to a durable Postgres connection string before deploying. (An intentional demo deployment with ALLOW_DEMO_DEPLOY=1 may run ephemeral storage.)",
    );
  }
}
