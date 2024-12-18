import { config } from "dotenv";
import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { ClaudeService } from "./services/ClaudeService";
import type { GamePattern } from "../../../src/types/patterns";

// Load environment variables
config();

async function createMockRuntime() {
    // In-memory storage for patterns
    const memoryStore = new Map();

    const mockMemoryManager = {
        runtime: null,
        tableName: "game_patterns",
        initialize: async () => {},
        createMemory: async (memory) => {
            console.log("[MockMemoryManager] Storing memory:", memory.id);
            memoryStore.set(memory.id, memory);
        },
        getMemory: async (id, tableName) => {
            console.log("[MockMemoryManager] Retrieving memory:", id);
            return memoryStore.get(id) || null;
        },
        updateMemory: async (memory) => {
            console.log("[MockMemoryManager] Updating memory:", memory.id);
            memoryStore.set(memory.id, memory);
        },
        deleteMemory: async (id, tableName) => {
            console.log("[MockMemoryManager] Deleting memory:", id);
            memoryStore.delete(id);
        },
        getMemories: async ({
            tableName,
            filter,
            count = 10,
            unique = true,
        }) => {
            console.log(
                "[MockMemoryManager] Getting memories with filter:",
                filter
            );
            return Array.from(memoryStore.values()).slice(0, count);
        },
        searchMemoriesByEmbedding: async (embedding, opts) => {
            console.log(
                "[MockMemoryManager] Searching by embedding, threshold:",
                opts?.match_threshold
            );
            // For testing, return all stored memories with a mock similarity score
            return Array.from(memoryStore.values()).map((memory) => ({
                ...memory,
                similarity: 0.9, // Mock similarity score
            }));
        },
        countMemories: async (roomId, unique) => memoryStore.size,
        addEmbeddingToMemory: async (memory) => memory,
        getCachedEmbeddings: async (content) => [],
        getMemoryById: async (id) => memoryStore.get(id) || null,
        getMemoriesByRoomIds: async ({ roomIds }) => {
            return Array.from(memoryStore.values()).filter((memory) =>
                roomIds.includes(memory.roomId)
            );
        },
        removeMemory: async (memoryId) => {
            memoryStore.delete(memoryId);
        },
        removeAllMemories: async (roomId) => {
            for (const [id, memory] of memoryStore.entries()) {
                if (memory.roomId === roomId) {
                    memoryStore.delete(id);
                }
            }
        },
    };

    const runtime = {
        logger: {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.log,
        },
        databaseAdapter: {
            query: async () => ({ rows: [] }),
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
            generateEmbedding: async (text: string) =>
                new Array(1536).fill(0).map(() => Math.random()),
        },
        getMemoryManager: () => mockMemoryManager,
    };

    // Set the runtime reference
    mockMemoryManager.runtime = runtime;

    return runtime;
}

async function testIntegration() {
    console.log(
        "[Integration Test] Starting ClaudeService and VectorDatabase integration test..."
    );

    try {
        // Initialize VectorDatabase
        console.log("[Integration Test] Initializing VectorDatabase...");
        const vectorDb = new VectorDatabase();
        await vectorDb.initialize(await createMockRuntime());
        console.log(
            "[Integration Test] VectorDatabase initialized successfully"
        );

        // Initialize ClaudeService
        console.log("[Integration Test] Initializing ClaudeService...");
        const claudeService = new ClaudeService(vectorDb);
        console.log(
            "[Integration Test] ClaudeService initialized successfully"
        );

        // Test pattern generation
        console.log("\n[Integration Test] Testing pattern generation...");
        const testPrompt =
            "Create a simple button that pulses with a subtle glow effect when hovered";

        try {
            const pattern = await claudeService.generatePattern(testPrompt);
            console.log("[Integration Test] Pattern generated successfully");
            console.log("[Integration Test] Pattern structure:", {
                title: pattern.title,
                description: pattern.description,
                htmlLength: pattern.html?.length || 0,
                hasPlan: !!pattern.plan,
            });

            // Verify pattern format
            if (
                !pattern.html ||
                !pattern.title ||
                !pattern.description ||
                !pattern.plan
            ) {
                throw new Error("Generated pattern missing required fields");
            }

            // Test pattern storage
            console.log("\n[Integration Test] Testing pattern storage...");
            const gamePattern = {
                id: "test-pattern-1",
                type: "ui",
                pattern_name: pattern.title,
                content: {
                    html: pattern.html,
                    css: pattern.css || [],
                    javascript: pattern.javascript || [],
                },
                embedding: await vectorDb.generateEmbedding(pattern.html),
                effectiveness_score: 0.8,
                usage_count: 0,
            };

            await vectorDb.storePattern(gamePattern);
            console.log("[Integration Test] Pattern stored successfully");

            // Test pattern retrieval
            console.log("\n[Integration Test] Testing pattern retrieval...");
            const retrievedPattern =
                await vectorDb.getPatternById("test-pattern-1");
            if (!retrievedPattern) {
                throw new Error("Failed to retrieve stored pattern");
            }
            console.log("[Integration Test] Pattern retrieved successfully");

            // Test similar pattern search
            console.log(
                "\n[Integration Test] Testing similar pattern search..."
            );
            const similarPatterns = await vectorDb.findSimilarPatterns(
                retrievedPattern.embedding,
                "ui",
                0.85,
                5
            );
            console.log(
                "[Integration Test] Found similar patterns:",
                similarPatterns.length
            );

            console.log(
                "\n[Integration Test] All tests completed successfully! 🎉"
            );
        } catch (error) {
            console.error(
                "[Integration Test] Pattern generation failed:",
                error
            );
            throw error;
        }
    } catch (error) {
        console.error("[Integration Test] Test failed:", error);
        process.exit(1);
    }
}

// Run the test
testIntegration().catch(console.error);
