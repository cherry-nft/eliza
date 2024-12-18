import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { config } from "dotenv";
import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import fetch from "node-fetch";
import { PatternLoader } from "./services/PatternLoader";

// Load environment variables
config();

// Initialize runtime dependencies with in-memory storage
const memoryStore = new Map<string, any>();

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

// Create runtime object with proper implementations
const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
    databaseAdapter: {
        query: async (sql: string, params?: any[]) => {
            console.log("[Database] Query:", sql, params);
            return { rows: [] };
        },
        transaction: async (callback) =>
            callback({ query: async () => ({ rows: [] }) }),
    },
    embeddingCache: {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
    },
    vectorOperations: {
        initialize: async () => {},
        generateEmbedding: async (text: string) => {
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
    },
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

async function viewStoredPatterns() {
    console.log("[PatternViewer] Starting pattern viewer...");

    // Initialize VectorDatabase with runtime
    const vectorDb = new VectorDatabase();
    await vectorDb.initialize(runtime);

    try {
        // Load patterns from JSON first
        const patternLoader = new PatternLoader(vectorDb);
        await patternLoader.loadPatternsFromJson();

        // Get all patterns from the memory manager
        const patterns = await memoryManager.getMemories({
            tableName: "game_patterns",
            count: 100,
        });

        console.log(
            `[PatternViewer] Found ${patterns.length} patterns in database`
        );

        // Display each pattern's details
        for (const pattern of patterns) {
            console.log("\n==============================================");
            console.log(`Pattern ID: ${pattern.id}`);
            console.log(`Type: ${pattern.type || "N/A"}`);
            console.log(`Pattern Name: ${pattern.pattern_name || "N/A"}`);
            console.log("\nHTML Content Preview (first 500 chars):");
            const html =
                pattern.content?.html ||
                pattern.content?.implementation?.html?.join("\n") ||
                "No HTML content";
            console.log(html.substring(0, 500) + "...");
            console.log("\nEmbedding Preview (first 5 values):");
            console.log(pattern.embedding?.slice(0, 5) || "No embedding");
            console.log("==============================================\n");
        }
    } catch (error) {
        console.error("[PatternViewer] Error:", error);
    }
}

viewStoredPatterns().catch(console.error);
