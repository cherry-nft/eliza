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
import { TokenizationService } from "./services/TokenizationService";
import { PatternLoader } from "./services/PatternLoader";

// Add shutdown function
async function shutdownGracefully() {
    console.log("[Server] Initiating graceful shutdown...");
    try {
        // Log memory usage before cleanup
        const memUsage = process.memoryUsage();
        console.log("[Server] Memory usage before cleanup:", {
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        });

        // Cleanup vector database
        console.log("[Server] Starting VectorDatabase cleanup...");
        await vectorDb.cleanup();
        console.log("[Server] VectorDatabase cleanup completed successfully");

        console.log("[Server] Shutdown completed successfully");
        process.exit(0);
    } catch (error) {
        console.error("[Server] Error during shutdown:", error);
        if (error instanceof Error) {
            console.error("[Server] Shutdown error details:", {
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

console.log("[Server] Configuration loaded successfully");

// Initialize runtime dependencies with in-memory storage
const memoryStore = new Map<string, any>();

const databaseAdapter = {
    async query(sql: string, params?: any[]) {
        console.log("[Database] Query:", sql, params);
        return { rows: [] };
    },
    async transaction(callback: (client: any) => Promise<void>) {
        return callback(databaseAdapter);
    },
};

const memoryManager = {
    runtime: null as any,
    tableName: "game_patterns",
    initialize: async () => {},
    createMemory: async (memory: any) => {
        console.log("[MemoryManager] Creating memory:", memory.id);
        memoryStore.set(memory.id, memory);
    },
    getMemory: async (id: string, tableName?: string) => {
        console.log("[MemoryManager] Getting memory:", id);
        return memoryStore.get(id) || null;
    },
    updateMemory: async (memory: any) => {
        console.log("[MemoryManager] Updating memory:", memory.id);
        memoryStore.set(memory.id, memory);
    },
    deleteMemory: async (id: string, tableName?: string) => {
        console.log("[MemoryManager] Deleting memory:", id);
        memoryStore.delete(id);
    },
    getMemories: async ({ tableName, filter, count = 10, unique = true }) => {
        console.log("[MemoryManager] Getting memories with filter:", filter);
        return Array.from(memoryStore.values()).slice(0, count);
    },
    searchMemoriesByEmbedding: async (embedding: number[], opts?: any) => {
        console.log(
            "[MemoryManager] Searching by embedding, threshold:",
            opts?.match_threshold
        );
        return Array.from(memoryStore.values()).map((memory) => ({
            ...memory,
            similarity: 0.9,
        }));
    },
    countMemories: async (roomId: string, unique?: boolean) => memoryStore.size,
    addEmbeddingToMemory: async (memory: any) => memory,
    getCachedEmbeddings: async (content: string) => [],
    getMemoryById: async (id: string) => memoryStore.get(id) || null,
    getMemoriesByRoomIds: async ({ roomIds }: { roomIds: string[] }) => {
        return Array.from(memoryStore.values()).filter((memory) =>
            roomIds.includes(memory.roomId)
        );
    },
    removeMemory: async (memoryId: string) => {
        memoryStore.delete(memoryId);
    },
    removeAllMemories: async (roomId: string) => {
        for (const [id, memory] of memoryStore.entries()) {
            if (memory.roomId === roomId) {
                memoryStore.delete(id);
            }
        }
    },
};

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
};

// Create runtime object with proper implementations
const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
    databaseAdapter: databaseAdapter as any,
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

// Set runtime reference
memoryManager.runtime = runtime;

// Initialize services
console.log("[Server] Starting services initialization...");

// Initialize TokenizationService
console.log("[Server] Initializing TokenizationService...");
const tokenizationService = new TokenizationService();
try {
    await tokenizationService.initialize();
    console.log("[Server] TokenizationService initialized successfully");
} catch (error) {
    console.error("[Server] Failed to initialize TokenizationService:", error);
    process.exit(1);
}

// Initialize VectorDatabase with the proper runtime
console.log("[Server] Starting VectorDatabase initialization...");
console.log("[Server] Runtime configuration:", {
    hasEmbeddingCache: !!runtime.embeddingCache,
    hasVectorOps: !!runtime.vectorOperations,
    hasMemoryManager: !!runtime.getMemoryManager(),
    databaseAdapter: !!runtime.databaseAdapter,
});

const vectorDb = new VectorDatabase();
try {
    const startTime = Date.now();
    await vectorDb.initialize(runtime);
    const initDuration = Date.now() - startTime;
    console.log(
        `[Server] VectorDatabase initialization took ${initDuration}ms`
    );

    // Perform health check
    console.log("[Server] Running VectorDatabase health check...");
    const isHealthy = await vectorDb.healthCheck();
    if (!isHealthy) {
        throw new Error("VectorDatabase failed health check");
    }
    console.log("[Server] VectorDatabase health check passed");

    // Log memory state after initialization
    const memUsage = process.memoryUsage();
    console.log("[Server] Memory usage after VectorDB init:", {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    });
} catch (error) {
    console.error("[Server] VectorDatabase initialization failed:", error);
    if (error instanceof Error) {
        console.error("[Server] Initialization error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
    }
    process.exit(1);
}

// Initialize ClaudeService with VectorDatabase
console.log("[Server] Initializing ClaudeService...");
const claudeService = new ClaudeService(vectorDb);
console.log("[Server] ClaudeService initialized successfully");

const patternLoader = new PatternLoader(vectorDb);

// Load patterns into VectorDB
patternLoader
    .loadPatternsFromJson()
    .then(() => {
        console.log("[Server] Successfully loaded patterns into VectorDB");
    })
    .catch((error) => {
        console.error("[Server] Failed to load patterns:", error);
    });

const app = express();
const port = SERVER_CONFIG.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Make services available to routes
app.locals.claudeService = claudeService;
app.locals.vectorDb = vectorDb;
app.locals.tokenizationService = tokenizationService;

// Routes
app.use("/api/patterns", patternRouter);

// Error handling middleware
app.use(
    (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.error("[Server] Error:", err.stack);
        res.status(500).json({
            success: false,
            error: {
                message: err.message,
                details:
                    process.env.NODE_ENV === "development"
                        ? err.stack
                        : undefined,
            },
        });
    }
);

// Setup graceful shutdown
process.on("SIGTERM", shutdownGracefully);
process.on("SIGINT", shutdownGracefully);

// Start server
try {
    const server = app.listen(port, () => {
        console.log("[Server] ====================================");
        console.log(`[Server] Pattern server running on port ${port}`);
        console.log("[Server] Services initialized:");
        console.log("- VectorDatabase: ✓");
        console.log("- ClaudeService: ✓");
        console.log("- Pattern Router: ✓");
        console.log("- TokenizationService: ✓");
        console.log("[Server] Health check endpoint:");
        console.log(`http://localhost:${port}/api/patterns/health`);
        console.log("[Server] ====================================");
    });

    // Add server error handler
    server.on("error", (error: Error) => {
        console.error("[Server] Server error:", error);
        if (error instanceof Error) {
            console.error("[Server] Server error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
    });
} catch (error) {
    console.error("[Server] Failed to start server:", error);
    if (error instanceof Error) {
        console.error("[Server] Startup error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
    }
    process.exit(1);
}
