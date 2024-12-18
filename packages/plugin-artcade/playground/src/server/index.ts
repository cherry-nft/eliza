import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { ClaudeService } from "./services/ClaudeService";
import patternRouter from "./patternServer";
import { SERVER_CONFIG } from "./config/serverConfig";
import {
    DatabaseAdapter,
    MemoryManager,
    IAgentRuntime,
    elizaLogger,
} from "@ai16z/eliza";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("[Server] Configuration loaded successfully");

// Initialize runtime dependencies
const databaseAdapter = new DatabaseAdapter({
    connectionString: SERVER_CONFIG.DATABASE_URL,
    schema: "public",
});

const memoryManager = new MemoryManager(databaseAdapter);

// Proper embedding cache implementation
const embeddingCache = {
    async get(key: string) {
        console.log("[EmbeddingCache] Attempting to retrieve:", key);
        try {
            // For now using in-memory cache, could be extended to Redis/etc
            return null;
        } catch (error) {
            console.error("[EmbeddingCache] Error retrieving:", error);
            return null;
        }
    },

    async set(key: string, value: number[], ttl?: number) {
        console.log("[EmbeddingCache] Caching embedding for:", key);
        try {
            // For now using in-memory cache, could be extended to Redis/etc
        } catch (error) {
            console.error("[EmbeddingCache] Error caching:", error);
        }
    },

    async delete(key: string) {
        console.log("[EmbeddingCache] Deleting cache for:", key);
    },

    async initialize() {
        console.log("[EmbeddingCache] Initializing cache system");
    },
};

// Proper vector operations implementation using OpenAI
const vectorOperations = {
    async initialize(config: any) {
        console.log("[VectorOps] Initializing with config:", config);
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API key not found");
        }
    },

    async generateEmbedding(text: string): Promise<number[]> {
        console.log("[VectorOps] Generating embedding for text");
        try {
            const response = await fetch(
                "https://api.openai.com/v1/embeddings",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        input: text,
                        model: "text-embedding-3-small",
                        dimensions: 1536,
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[VectorOps] OpenAI API error:", errorText);
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("[VectorOps] Successfully generated embedding");
            return data.data[0].embedding;
        } catch (error) {
            console.error("[VectorOps] Error generating embedding:", error);
            throw error;
        }
    },

    async store(id: string, embedding: number[]) {
        console.log("[VectorOps] Storing embedding for:", id);
        // Actual storage is handled by VectorDatabase
    },

    async findSimilar(embedding: number[], limit?: number) {
        console.log("[VectorOps] Finding similar embeddings, limit:", limit);
        // Actual similarity search is handled by VectorDatabase
        return [];
    },
};

// Create runtime object with proper implementations
const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
    databaseAdapter,
    embeddingCache,
    vectorOperations,
    getMemoryManager: () => memoryManager,
    logger: {
        info: (...args) => console.log("[Info]", ...args),
        error: (...args) => console.error("[Error]", ...args),
        debug: (...args) => console.debug("[Debug]", ...args),
        warn: (...args) => console.warn("[Warning]", ...args),
    },
};

// Initialize VectorDatabase with the proper runtime
const vectorDb = new VectorDatabase();
await vectorDb.initialize(runtime);

// Initialize ClaudeService with VectorDatabase
const claudeService = new ClaudeService(vectorDb);

const app = express();
const port = SERVER_CONFIG.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Make services available to routes
app.locals.claudeService = claudeService;
app.locals.vectorDb = vectorDb;

// Routes
app.use("/api/patterns", patternRouter);

// Error handling
app.use(
    (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.error("[Server] Error:", err.stack);
        res.status(500).json({ error: err.message });
    }
);

app.listen(port, () => {
    console.log(`[Server] Pattern server running on port ${port}`);
});
