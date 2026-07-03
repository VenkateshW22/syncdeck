import dotenv from "dotenv";

// Load variables from a local .env file (no-op if the file doesn't exist,
// e.g. in Cloud Run / Docker where env vars are injected directly).
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
// Staging is treated identically to production for security validation:
// all required env vars must be set; no in-memory / embedded fallbacks.
const IS_STAGING = NODE_ENV === "staging";
const IS_PROD_LIKE = IS_PRODUCTION || IS_STAGING;

// Values that must NEVER be used in production or staging. If any of these
// are still present, either the env var wasn't set or someone copy-pasted
// the sample.
const INSECURE_DEFAULTS = new Set([
  "change_this_secret_in_production",
  "change_this_refresh_secret",
  "dev_only_jwt_secret_do_not_use_in_prod",
  "dev_only_refresh_secret_do_not_use_in_prod",
  "dev_only_jwt_secret_do_not_use_in_prod_at_least_32chars",
  "dev_only_refresh_secret_do_not_use_in_prod_32chars",
  "postgres",
  "",
]);

interface RequiredVar {
  key: string;
  minLength?: number;
  validate?: (value: string) => string | null; // return an error message, or null if valid
}

const REQUIRED_IN_PRODUCTION: RequiredVar[] = [
  { key: "JWT_SECRET", minLength: 32 },
  { key: "REFRESH_SECRET", minLength: 32 },
  { key: "DATABASE_URL" },
  { key: "REDIS_URL" },
  { key: "APP_ORIGIN" },
];

function collectErrors(): string[] {
  const errors: string[] = [];

  for (const { key, minLength, validate } of REQUIRED_IN_PRODUCTION) {
    const value = process.env[key];

    if (!value || INSECURE_DEFAULTS.has(value)) {
      errors.push(`${key} is missing (or still set to an insecure placeholder).`);
      continue;
    }

    if (minLength && value.length < minLength) {
      errors.push(`${key} is too short (need at least ${minLength} characters, got ${value.length}).`);
    }

    if (validate) {
      const err = validate(value);
      if (err) errors.push(`${key}: ${err}`);
    }
  }

  if (process.env.JWT_SECRET && process.env.REFRESH_SECRET && process.env.JWT_SECRET === process.env.REFRESH_SECRET) {
    errors.push("JWT_SECRET and REFRESH_SECRET must not be the same value.");
  }

  return errors;
}

/**
 * Validates required environment configuration. In production AND staging this
 * fails fast (throws / exits) rather than silently falling back to insecure or
 * non-persistent defaults (e.g. an in-memory Redis mock, an embedded
 * ephemeral database, or a hardcoded JWT secret). Booting successfully with
 * the wrong config is worse than not booting at all.
 */
export function validateEnv(): void {
  if (!IS_PROD_LIKE) {
    // In development, missing vars are fine — the app falls back to local
    // in-memory/embedded implementations. Just warn so it's not a surprise.
    const missing = REQUIRED_IN_PRODUCTION.filter(({ key }) => !process.env[key]).map((v) => v.key);
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Config] Running in development without: ${missing.join(", ")}. ` +
          `Using local fallbacks. Set these before deploying to production.`
      );
    }
    return;
  }

  const errors = collectErrors();
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[Config] Refusing to start in ${NODE_ENV} due to invalid configuration:`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nSet these environment variables (see .env.example) and restart.");
    process.exit(1);
  }
}

// IMPORTANT (module evaluation order): this runs as a side effect of
// importing this module, not something the importer has to remember to
// call. In ES modules, all of a file's imports are fully evaluated — in the
// order they're written — before any of that file's own top-level
// statements run. So if this validation were instead a statement inside
// server.ts placed after other imports (e.g. redis, db), those modules
// would already have read process.env by the time it ran. Running it here,
// at the top of this module, guarantees it executes before any
// later-imported module (redis.ts, db/index.ts, jwt.ts) gets evaluated, as
// long as this module is imported first in server.ts.
validateEnv();

export const env = {
  NODE_ENV,
  IS_PRODUCTION,
  IS_STAGING,
  IS_PROD_LIKE,
  IS_GCP: Boolean(process.env.K_SERVICE),
  K_SERVICE: process.env.K_SERVICE || null,
  K_REVISION: process.env.K_REVISION || null,
  INSTANCE_ID: process.env.K_REVISION || process.env.INSTANCE_ID || "local",
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: process.env.JWT_SECRET || "dev_only_jwt_secret_do_not_use_in_prod_at_least_32chars",
  REFRESH_SECRET: process.env.REFRESH_SECRET || "dev_only_refresh_secret_do_not_use_in_prod_32chars",
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  APP_ORIGIN: process.env.APP_ORIGIN,
  APP_URL: process.env.APP_URL,
};
