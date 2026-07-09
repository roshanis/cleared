import { createMemoryDriver } from "./memory";
import { createSqliteDriver } from "./sqlite";
import type { StoreDriver } from "./driver";

// ---------------------------------------------------------------------------
// Driver-change listeners (store.ts registers here so it can reset its memo)
// ---------------------------------------------------------------------------

type DriverChangedCallback = () => void;
const changeListeners: DriverChangedCallback[] = [];

/** Register a callback that fires whenever setDriverForTests() is called. */
export function onDriverChange(cb: DriverChangedCallback): void {
  changeListeners.push(cb);
}

// ---------------------------------------------------------------------------
// Driver selection
// ---------------------------------------------------------------------------

let overrideDriver: StoreDriver | null = null;
let defaultDriver: StoreDriver | null = null;

function createDefaultDriver(): StoreDriver {
  if (process.env.DATABASE_URL ?? process.env.POSTGRES_URL) {
    // Lazy: createPostgresDriver() is imported asynchronously inside the
    // factory to keep pg out of the module graph unless needed.
    // We return a thin shell that delegates once the real driver is ready.
    let inner: StoreDriver | null = null;
    const enqueueInit = (async () => {
      const { createPostgresDriver } = await import("./postgres");
      inner = createPostgresDriver();
    })();

    async function awaitInner(): Promise<StoreDriver> {
      await enqueueInit;
      return inner!;
    }

    return {
      kind: "postgres",
      async init() {
        return (await awaitInner()).init();
      },
      async snapshot() {
        return (await awaitInner()).snapshot();
      },
      async transact(fn) {
        return (await awaitInner()).transact(fn);
      },
      async schemaVersion() {
        return (await awaitInner()).schemaVersion();
      },
    };
  }

  if (process.env.NODE_ENV === "test") return createMemoryDriver();
  if (process.env.VERCEL) return createMemoryDriver();

  // Default: local SQLite
  return createSqliteDriver();
}

/** Returns the active driver (override from test hook, else environment default). */
export function getDriver(): StoreDriver {
  if (overrideDriver) return overrideDriver;
  return (defaultDriver ??= createDefaultDriver());
}

/**
 * Replace the active driver (test hook). Notifies store.ts via onDriverChange
 * so it can reset its ready-memo.
 */
export function setDriverForTests(driver: StoreDriver): void {
  overrideDriver = driver;
  for (const cb of changeListeners) cb();
}
