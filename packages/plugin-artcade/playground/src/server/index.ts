import express from "express";
import cors from "cors";
import { elizaLogger } from "@ai16z/eliza";
import { ClaudeService } from "./services/ClaudeService";
import { testServerSupabaseConnection } from "./config/serverSupabaseConfig";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

elizaLogger.info("Starting services initialization...");

// Initialize services
elizaLogger.info("Initializing TokenizationService...");

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Claude service with API key from environment
const claudeService = new ClaudeService({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
});

// Test Supabase connection
await testServerSupabaseConnection();

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
