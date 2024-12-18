import { ENV, validateEnv } from "./clientEnv";

// Validate environment variables
validateEnv();

export const CLIENT_CONFIG = {
    API_BASE_URL: ENV.API_BASE_URL,
    OPENROUTER_API_KEY: ENV.VITE_OPENROUTER_API_KEY,
    NODE_ENV: ENV.NODE_ENV,
} as const;

export type ClientConfig = typeof CLIENT_CONFIG;
