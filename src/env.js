import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Every value defaults to the local emulator project (`demo-cricscore`), so
 * a fresh checkout runs with no configuration. Set real values for a
 * deployed Firebase project.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Service-account JSON (raw or base64) for the Admin SDK in production. */
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default("demo-api-key"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default("demo-cricscore"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
    /** "true" to use the local Firebase Emulator Suite. */
    NEXT_PUBLIC_FIREBASE_USE_EMULATOR: z
      .enum(["true", "false"])
      .default("true"),
    /** Host the browser uses for the emulators (LAN IP for phone testing). */
    NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: z.string().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_USE_EMULATOR:
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR,
    NEXT_PUBLIC_FIREBASE_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
