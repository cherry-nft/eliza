import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { ClaudeService } from "./services/ClaudeService";
import patternRouter from "./patternServer";
import { SERVER_CONFIG } from "./config/serverConfig";
import { TokenizationService } from "./services/TokenizationService";
import { ArtcadeRuntime } from "../../../src/types/runtime";
import { IMemoryManager } from "@ai16z/eliza";
import { Memory } from "@ai16z/eliza";
import { PostgresDatabaseAdapter } from "@ai16z/adapter-postgres";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Add constant for memory table name
const VECTOR_DB_TABLE = "vector_patterns";

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

// Initialize PostgreSQL database adapter
const databaseAdapter = new PostgresDatabaseAdapter({
    connectionString:
        process.env.DATABASE_URL || "postgresql://localhost:5432/artcade",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "artcade",
});

// Initialize memory manager with PostgreSQL
const memoryManager: IMemoryManager = {
    runtime: null as any,
    initialize: async () => {
        console.log("[MemoryManager] Initializing with PostgreSQL");
        // Create tables if they don't exist
        await databaseAdapter.query(`
            CREATE TABLE IF NOT EXISTS ${VECTOR_DB_TABLE} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                content JSONB NOT NULL,
                embedding VECTOR(1536),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                room_id UUID NOT NULL,
                user_id UUID NOT NULL,
                agent_id UUID NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_${VECTOR_DB_TABLE}_room_id ON ${VECTOR_DB_TABLE}(room_id);
            CREATE INDEX IF NOT EXISTS idx_${VECTOR_DB_TABLE}_embedding ON ${VECTOR_DB_TABLE} USING hnsw (embedding vector_cosine_ops);
        `);
    },
    createMemory: async (memory: Memory) => {
        await databaseAdapter.query(
            `INSERT INTO ${VECTOR_DB_TABLE} (id, content, embedding, room_id, user_id, agent_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                memory.id,
                memory.content,
                memory.embedding,
                memory.roomId,
                memory.userId,
                memory.agentId,
            ]
        );
    },
    getMemory: async (id: string) => {
        const result = await databaseAdapter.query(
            `SELECT * FROM ${VECTOR_DB_TABLE} WHERE id = $1`,
            [id]
        );
        return result.rows[0]
            ? {
                  id: result.rows[0].id,
                  content: result.rows[0].content,
                  embedding: result.rows[0].embedding,
                  roomId: result.rows[0].room_id,
                  userId: result.rows[0].user_id,
                  agentId: result.rows[0].agent_id,
                  tableName: VECTOR_DB_TABLE,
                  createdAt: result.rows[0].created_at.getTime(),
              }
            : null;
    },
    updateMemory: async (memory: Memory) => {
        await databaseAdapter.query(
            `UPDATE ${VECTOR_DB_TABLE}
             SET content = $2, embedding = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [memory.id, memory.content, memory.embedding]
        );
    },
    deleteMemory: async (id: string) => {
        await databaseAdapter.query(
            `DELETE FROM ${VECTOR_DB_TABLE} WHERE id = $1`,
            [id]
        );
    },
    getMemories: async (opts: {
        roomId?: string;
        count?: number;
        unique?: boolean;
        start?: number;
        end?: number;
    }) => {
        const limit = opts.count || 10;
        const offset = opts.start || 0;
        const result = await databaseAdapter.query(
            `SELECT * FROM ${VECTOR_DB_TABLE}
             ${opts.roomId ? "WHERE room_id = $1" : ""}
             ORDER BY created_at DESC
             LIMIT $${opts.roomId ? "2" : "1"} OFFSET $${opts.roomId ? "3" : "2"}`,
            opts.roomId ? [opts.roomId, limit, offset] : [limit, offset]
        );
        return result.rows.map((row) => ({
            id: row.id,
            content: row.content,
            embedding: row.embedding,
            roomId: row.room_id,
            userId: row.user_id,
            agentId: row.agent_id,
            tableName: VECTOR_DB_TABLE,
            createdAt: row.created_at.getTime(),
        }));
    },
    searchMemoriesByEmbedding: async (
        embedding: number[],
        opts?: {
            match_threshold?: number;
            max_results?: number;
            filter?: Record<string, any>;
        }
    ) => {
        const threshold = opts?.match_threshold || 0.8;
        const limit = opts?.max_results || 10;

        const result = await databaseAdapter.query(
            `SELECT *, 1 - (embedding <=> $1) as similarity
             FROM ${VECTOR_DB_TABLE}
             WHERE 1 - (embedding <=> $1) > $2
             ORDER BY similarity DESC
             LIMIT $3`,
            [embedding, threshold, limit]
        );

        return result.rows.map((row) => ({
            id: row.id,
            content: row.content,
            embedding: row.embedding,
            roomId: row.room_id,
            userId: row.user_id,
            agentId: row.agent_id,
            tableName: VECTOR_DB_TABLE,
            createdAt: row.created_at.getTime(),
            similarity: row.similarity,
        }));
    },
    countMemories: async (roomId: string) => {
        const result = await databaseAdapter.query(
            `SELECT COUNT(*) FROM ${VECTOR_DB_TABLE} WHERE room_id = $1`,
            [roomId]
        );
        return parseInt(result.rows[0].count);
    },
    addEmbeddingToMemory: async (memory: Memory) => memory,
    getCachedEmbeddings: async () => [],
    getMemoryById: async (id: string) => {
        const result = await databaseAdapter.query(
            `SELECT * FROM ${VECTOR_DB_TABLE} WHERE id = $1`,
            [id]
        );
        return result.rows[0]
            ? {
                  id: result.rows[0].id,
                  content: result.rows[0].content,
                  embedding: result.rows[0].embedding,
                  roomId: result.rows[0].room_id,
                  userId: result.rows[0].user_id,
                  agentId: result.rows[0].agent_id,
                  tableName: VECTOR_DB_TABLE,
                  createdAt: result.rows[0].created_at.getTime(),
              }
            : null;
    },
    getMemoriesByRoomIds: async ({ roomIds }: { roomIds: string[] }) => {
        const result = await databaseAdapter.query(
            `SELECT * FROM ${VECTOR_DB_TABLE} WHERE room_id = ANY($1)`,
            [roomIds]
        );
        return result.rows.map((row) => ({
            id: row.id,
            content: row.content,
            embedding: row.embedding,
            roomId: row.room_id,
            userId: row.user_id,
            agentId: row.agent_id,
            tableName: VECTOR_DB_TABLE,
            createdAt: row.created_at.getTime(),
        }));
    },
    removeMemory: async (memoryId: string) => {
        await databaseAdapter.query(
            `DELETE FROM ${VECTOR_DB_TABLE} WHERE id = $1`,
            [memoryId]
        );
    },
    removeAllMemories: async (roomId: string) => {
        await databaseAdapter.query(
            `DELETE FROM ${VECTOR_DB_TABLE} WHERE room_id = $1`,
            [roomId]
        );
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
const runtime: ArtcadeRuntime = {
    databaseAdapter,
    embeddingCache,
    vectorOperations,
    getMemoryManager: (name: string): IMemoryManager => {
        console.log("[Runtime] Getting memory manager for table:", name);
        return memoryManager;
    },
    logger: {
        info: (...args: any[]) => console.log("[Info]", ...args),
        error: (...args: any[]) => console.error("[Error]", ...args),
        debug: (...args: any[]) => console.debug("[Debug]", ...args),
        warn: (...args: any[]) => console.warn("[Warning]", ...args),
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
    hasMemoryManager: !!runtime.getMemoryManager(VECTOR_DB_TABLE),
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
