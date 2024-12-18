export function validateEnvironment() {
    console.log("[Environment] Validating environment variables...");

    const requiredVars = ["VITE_OPENROUTER_API_KEY"];

    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
        console.error(
            "[Environment] Missing required environment variables:",
            missing
        );
        console.error(
            "[Environment] Available environment variables:",
            Object.keys(process.env)
        );
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }

    console.log("[Environment] Environment validation successful");
    return true;
}
