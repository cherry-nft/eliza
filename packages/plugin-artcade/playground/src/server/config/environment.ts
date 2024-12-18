import { config as dotenvConfig } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ServerConfig {
    OPENROUTER_API_KEY: string;
    PROMPT_PATH: string;
    NODE_ENV: string;
}

export const loadServerConfig = (): ServerConfig => {
    console.log("[ServerConfig] Starting server configuration loading...");

    // Load environment variables
    const envResult = dotenvConfig();
    if (envResult.error) {
        console.error(
            "[ServerConfig] Error loading .env file:",
            envResult.error
        );
        throw new Error("Failed to load .env file");
    }
    console.log("[ServerConfig] Successfully loaded .env file");

    // Construct paths
    const promptPath = join(__dirname, "../../public/artcade-prompt.md");
    console.log("[ServerConfig] Resolved prompt path:", promptPath);

    // Get API key - try both VITE_ prefixed and non-prefixed versions
    const apiKey =
        process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error(
            "[ServerConfig] OpenRouter API key not found in environment variables"
        );
        console.error("[ServerConfig] Available environment variables:", {
            viteKeys: Object.keys(process.env).filter((key) =>
                key.startsWith("VITE_")
            ),
            regularKeys: Object.keys(process.env).filter(
                (key) => !key.startsWith("VITE_")
            ),
        });
        throw new Error("OpenRouter API key not found");
    }
    console.log("[ServerConfig] Successfully loaded API key");

    const serverConfig: ServerConfig = {
        OPENROUTER_API_KEY: apiKey,
        PROMPT_PATH: promptPath,
        NODE_ENV: process.env.NODE_ENV || "development",
    };

    console.log("[ServerConfig] Configuration loaded successfully:", {
        promptPath: serverConfig.PROMPT_PATH,
        nodeEnv: serverConfig.NODE_ENV,
        hasApiKey: !!serverConfig.OPENROUTER_API_KEY,
        apiKeyLength: serverConfig.OPENROUTER_API_KEY.length,
    });

    return serverConfig;
};
