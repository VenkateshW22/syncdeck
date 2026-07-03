/// <reference types="vite/client" />
/**
 * src/config/env.ts
 *
 * Typed access to VITE_* environment variables baked in at build time.
 *
 * All VITE_* vars are replaced by Vite at build time with their string
 * values from the active .env file. They are NOT available at runtime
 * from process.env — they are inlined into the bundle.
 *
 * Usage:
 *   import { clientEnv } from '@/src/config/env';
 *   console.log(clientEnv.APP_ENV);   // "development" | "staging" | "production"
 */

type AppEnv = "development" | "staging" | "production" | "ci";

export const clientEnv = {
  /** Which environment the app is running in. Defaults to "development". */
  APP_ENV: (import.meta.env.VITE_APP_ENV as AppEnv) || "development",

  /** Display name for the app (may include "(Staging)" suffix in staging). */
  APP_NAME: import.meta.env.VITE_APP_NAME || "SyncDeck",

  /** True only in production. */
  IS_PRODUCTION: import.meta.env.VITE_APP_ENV === "production",

  /** True in staging or production (prod-like). */
  IS_PROD_LIKE:
    import.meta.env.VITE_APP_ENV === "production" ||
    import.meta.env.VITE_APP_ENV === "staging",

  /** True in development. */
  IS_DEV: import.meta.env.DEV,
} as const;
