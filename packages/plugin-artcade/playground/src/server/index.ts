import express from "express";
import cors from "cors";
import { elizaLogger } from "@ai16z/eliza";
import { ClaudeService } from "./services/ClaudeService";
import { testServerSupabaseConnection } from "./config/serverSupabaseConfig";
import { VectorSupabase } from "../../../src/services/VectorSupabase";
import patternRouter from "./patternServer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

elizaLogger.info("Starting services initialization...");

// Initialize services
elizaLogger.info("Initializing TokenizationService...");

const app = express();
app.use(cors());
app.use(express.json());

// Validate required environment variables
if (!process.env.SUPABASE_PROJECT_URL) {
    throw new Error("SUPABASE_PROJECT_URL is required");
}

// Initialize services
const vectorDb = new VectorSupabase(process.env.SUPABASE_PROJECT_URL);
const claudeService = new ClaudeService({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    vectorDb: vectorDb,
});

// Attach services to app.locals
app.locals.vectorDb = vectorDb;
app.locals.claudeService = claudeService;

// Test Supabase connection
await testServerSupabaseConnection();

// Mount pattern router at /api/patterns
app.use("/api/patterns", patternRouter);

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

// Pattern generation endpoint
app.post("/generate", async (req, res) => {
    try {
        const { prompt } = req.body;
        const result = await claudeService.generatePattern(prompt);
        res.json(result);
    } catch (error) {
        elizaLogger.error("Error generating pattern:", error);
        res.status(500).json({
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
            },
        });
    }
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
    elizaLogger.info(`Server running on port ${port}`);
});
