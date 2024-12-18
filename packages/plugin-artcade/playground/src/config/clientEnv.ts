// Client-side environment configuration
export const ENV = {
    NODE_ENV: import.meta.env.MODE,
    VITE_OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
    API_BASE_URL:
        import.meta.env.VITE_API_BASE_URL ||
        "http://localhost:3001/api/patterns",
} as const;

// Type for the environment configuration
export type Environment = typeof ENV;

// Helper function to validate environment variables
export function validateEnv(): void {
    const requiredVars = ["VITE_OPENROUTER_API_KEY"] as const;
    const missing = requiredVars.filter((key) => !ENV[key]);

    if (missing.length > 0) {
        console.error(
            "Missing required environment variables:",
            missing.join(", ")
        );
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }
}
