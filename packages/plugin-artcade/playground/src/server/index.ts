import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { VectorSupabase } from "../../../src/services/VectorSupabase";
import { ClaudeService } from "./services/ClaudeService";
import patternRouter from "./patternServer";
import { SERVER_CONFIG } from "./config/serverConfig";
import { TokenizationService } from "./services/TokenizationService";
import { elizaLogger } from "@ai16z/eliza";
import {
    supabaseClient,
    testSupabaseConnection,
} from "../config/supabaseConfig";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Add constant for vector table name
const VECTOR_DB_TABLE = "vector_patterns";

// Initialize VectorSupabase
const vectorDb = new VectorSupabase(process.env.SUPABASE_PROJECT_URL!);

// Add shutdown function
async function shutdownGracefully() {
    elizaLogger.info("[Server] Initiating graceful shutdown...");
    try {
        // Log memory usage before cleanup
        const memUsage = process.memoryUsage();
        elizaLogger.info("[Server] Memory usage before cleanup:", {
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        });

        elizaLogger.info("[Server] Shutdown completed successfully");
        process.exit(0);
    } catch (error) {
        elizaLogger.error("[Server] Error during shutdown:", error);
        if (error instanceof Error) {
            elizaLogger.error("[Server] Shutdown error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        process.exit(1);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize services
const tokenizationService = new TokenizationService();
const claudeService = new ClaudeService(vectorDb);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
elizaLogger.info("[Server] Starting services initialization...");

// Add services to app.locals
app.locals.vectorDb = vectorDb;
app.locals.tokenizationService = tokenizationService;
app.locals.claudeService = claudeService;

// Initialize TokenizationService
elizaLogger.info("[Server] Initializing TokenizationService...");
await tokenizationService.initialize();
elizaLogger.info("[Server] TokenizationService initialized successfully");

// Test Supabase connection
const isConnected = await testSupabaseConnection();
if (!isConnected) {
    elizaLogger.error("[Server] Failed to connect to Supabase");
    process.exit(1);
}

// Setup routes
app.use("/api/patterns", patternRouter);

// Add health check endpoint
app.get("/health", async (req, res) => {
    try {
        const isConnected = await testSupabaseConnection();
        res.json({
            status: isConnected ? "healthy" : "error",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    elizaLogger.info(`[Server] Running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", shutdownGracefully);
process.on("SIGINT", shutdownGracefully);
