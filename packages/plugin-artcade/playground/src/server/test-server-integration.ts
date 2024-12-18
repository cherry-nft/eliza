import { config } from "dotenv";
import {
    DatabaseAdapter,
    MemoryManager,
    IAgentRuntime,
    elizaLogger,
} from "@ai16z/eliza";
import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { ClaudeService } from "./services/ClaudeService";
import { SERVER_CONFIG } from "./config/serverConfig";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testServerIntegration() {
    console.log("[Test] Starting full server integration test...");
    console.log("[Test] Node version:", process.version);
    console.log("[Test] Current working directory:", process.cwd());

    try {
        // Initialize runtime with real vector operations
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
                        console.error(
                            "[VectorOps] OpenAI API error:",
                            errorText
                        );
                        throw new Error(
                            `OpenAI API error: ${response.statusText}`
                        );
                    }

                    const data = await response.json();
                    console.log("[VectorOps] Successfully generated embedding");
                    return data.data[0].embedding;
                } catch (error) {
                    console.error(
                        "[VectorOps] Error generating embedding:",
                        error
                    );
                    throw error;
                }
            },
        };

        // Initialize in-memory storage
        const storedPatterns = new Map<string, any>();

        // Create memory manager with storage
        const memoryManager = {
            runtime: null as any,
            tableName: "game_patterns",
            initialize: async () => {},
            createMemory: async (memory: any) => {
                console.log("[MemoryManager] Creating memory:", memory.id);
                storedPatterns.set(memory.id, memory);
            },
            getMemory: async (id: string, tableName?: string) => {
                console.log("[MemoryManager] Getting memory:", id);
                return storedPatterns.get(id) || null;
            },
            updateMemory: async (memory: any) => {
                console.log("[MemoryManager] Updating memory:", memory.id);
                storedPatterns.set(memory.id, memory);
            },
            deleteMemory: async (id: string, tableName?: string) => {
                console.log("[MemoryManager] Deleting memory:", id);
                storedPatterns.delete(id);
            },
            getMemories: async ({
                tableName,
                filter,
                count = 10,
                unique = true,
            }) => {
                console.log(
                    "[MemoryManager] Getting memories with filter:",
                    filter
                );
                return Array.from(storedPatterns.values()).slice(0, count);
            },
            searchMemoriesByEmbedding: async (
                embedding: number[],
                opts?: any
            ) => {
                console.log(
                    "[MemoryManager] Searching by embedding, threshold:",
                    opts?.match_threshold
                );
                return Array.from(storedPatterns.values()).map((memory) => ({
                    ...memory,
                    similarity: 0.9,
                }));
            },
            countMemories: async (roomId: string, unique?: boolean) =>
                storedPatterns.size,
            addEmbeddingToMemory: async (memory: any) => memory,
            getCachedEmbeddings: async (content: string) => [],
            getMemoryById: async (id: string) => storedPatterns.get(id) || null,
            getMemoriesByRoomIds: async ({
                roomIds,
            }: {
                roomIds: string[];
            }) => {
                return Array.from(storedPatterns.values()).filter((memory) =>
                    roomIds.includes(memory.roomId)
                );
            },
            removeMemory: async (memoryId: string) => {
                storedPatterns.delete(memoryId);
            },
            removeAllMemories: async (roomId: string) => {
                for (const [id, memory] of storedPatterns.entries()) {
                    if (memory.roomId === roomId) {
                        storedPatterns.delete(id);
                    }
                }
            },
        };

        // Create runtime
        const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
            databaseAdapter: {
                query: async () => ({ rows: [] }),
                transaction: async (callback) =>
                    callback({ query: async () => ({ rows: [] }) }),
            } as unknown as DatabaseAdapter<any>,
            embeddingCache: {
                get: async () => null,
                set: async () => {},
                delete: async () => {},
                initialize: async () => {},
            },
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

        // Initialize VectorDatabase
        console.log("\n[Test] Initializing VectorDatabase...");
        const vectorDb = new VectorDatabase();
        await vectorDb.initialize(runtime);

        // Verify database health
        console.log("\n[Test] Checking database health...");
        const isHealthy = await vectorDb.healthCheck();
        if (!isHealthy) {
            throw new Error("VectorDatabase health check failed");
        }
        console.log("[Test] Database health check passed");

        // Initialize ClaudeService
        console.log("\n[Test] Initializing ClaudeService...");
        const claudeService = new ClaudeService(vectorDb);
        console.log("[Test] ClaudeService initialized successfully");

        // Test 1: Generate a new pattern
        console.log("\n[Test] Testing pattern generation...");
        const testPrompt =
            "Create a simple button that pulses with a subtle glow effect when hovered";
        const generatedPattern =
            await claudeService.generatePattern(testPrompt);
        console.log("[Test] Pattern generated successfully");
        console.log("Pattern structure:", {
            title: generatedPattern.title,
            description: generatedPattern.description,
            htmlLength: generatedPattern.html?.length || 0,
            hasPlan: !!generatedPattern.plan,
        });

        // Test 2: Store the generated pattern
        console.log("\n[Test] Testing pattern storage...");
        const patternId = randomUUID();
        const gamePattern = {
            id: patternId,
            type: "ui",
            pattern_name: generatedPattern.title,
            content: {
                html: generatedPattern.html,
                css: generatedPattern.css || [],
                javascript: generatedPattern.javascript || [],
            },
            embedding: await vectorDb.generateEmbedding(
                generatedPattern.html || ""
            ),
            effectiveness_score: 0.8,
            usage_count: 0,
        };

        await vectorDb.storePattern(gamePattern);
        console.log("[Test] Pattern stored successfully");

        // Test 3: Retrieve the stored pattern
        console.log("\n[Test] Testing pattern retrieval...");
        const retrievedPattern = await vectorDb.getPatternById(patternId);
        if (!retrievedPattern) {
            throw new Error("Failed to retrieve stored pattern");
        }
        console.log("[Test] Pattern retrieved successfully");
        console.log("Retrieved pattern:", {
            id: retrievedPattern.id,
            name: retrievedPattern.pattern_name,
            type: retrievedPattern.type,
        });

        // Test 4: Find similar patterns
        console.log("\n[Test] Testing similar pattern search...");
        const similarPatterns = await vectorDb.findSimilarPatterns(
            retrievedPattern.embedding,
            retrievedPattern.type,
            0.85,
            5
        );
        console.log("[Test] Found similar patterns:", similarPatterns.length);

        // Test 5: Generate a pattern with reference to existing patterns
        console.log("\n[Test] Testing pattern generation with references...");
        const enhancedPrompt =
            "Create a button similar to the previous one but with a rainbow gradient effect";
        const enhancedPattern =
            await claudeService.generatePattern(enhancedPrompt);
        console.log("[Test] Enhanced pattern generated successfully");
        console.log("Enhanced pattern structure:", {
            title: enhancedPattern.title,
            description: enhancedPattern.description,
            htmlLength: enhancedPattern.html?.length || 0,
            hasPlan: !!enhancedPattern.plan,
        });

        console.log("\n[Test] All tests completed successfully! 🎉");
        process.exit(0);
    } catch (error) {
        console.error("\n[Test] Test failed:", error);
        process.exit(1);
    }
}

// Run the test
testServerIntegration();
