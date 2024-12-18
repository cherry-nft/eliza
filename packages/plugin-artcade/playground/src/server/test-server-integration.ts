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

async function testEmbeddingGeneration() {
    console.log("[Test] Starting embedding generation test...");

    try {
        // Load a single pattern from patterns.json
        const patternsPath = path.join(
            __dirname,
            "../../../src/data/patterns.json"
        );
        const patterns = JSON.parse(readFileSync(patternsPath, "utf-8"));
        const sourcePattern = patterns[0]; // Use the first pattern

        // Mock storage for patterns
        const storedPatterns = new Map<string, any>();

        // Initialize runtime dependencies with proper mocks
        const databaseAdapter = {
            query: async (sql: string, params?: any[]) => {
                console.log("[Database] Executing query:", sql);
                if (params) {
                    console.log("[Database] With params:", params);
                }
                return { rows: [] };
            },
            transaction: async (callback: (client: any) => Promise<void>) => {
                return callback(databaseAdapter);
            },
            createMemory: async (memory: any) => {
                console.log("[Database] Creating memory:", memory);
                storedPatterns.set(memory.id, memory);
                return memory;
            },
            getMemory: async (id: string) => {
                console.log("[Database] Getting memory:", id);
                return storedPatterns.get(id) || null;
            },
            updateMemory: async (memory: any) => {
                console.log("[Database] Updating memory:", memory);
                storedPatterns.set(memory.id, memory);
            },
            deleteMemory: async (id: string) => {
                console.log("[Database] Deleting memory:", id);
                storedPatterns.delete(id);
            },
            searchMemories: async (params: any) => {
                console.log("[Database] Searching memories:", params);
                return Array.from(storedPatterns.values());
            },
            searchMemoriesByEmbedding: async (
                embedding: number[],
                params: any
            ) => {
                console.log("[Database] Searching by embedding");
                return Array.from(storedPatterns.values());
            },
        } as unknown as DatabaseAdapter<any>;

        const memoryManager = {
            createMemory: async (memory: any) => {
                console.log("[MemoryManager] Creating memory:", memory);
                storedPatterns.set(memory.id, memory);
                return memory;
            },
            getMemory: async (id: string) => {
                console.log("[MemoryManager] Getting memory:", id);
                return storedPatterns.get(id) || null;
            },
            updateMemory: async (memory: any) => {
                console.log("[MemoryManager] Updating memory:", memory);
                storedPatterns.set(memory.id, memory);
            },
            deleteMemory: async (id: string) => {
                console.log("[MemoryManager] Deleting memory:", id);
                storedPatterns.delete(id);
            },
            searchMemories: async (params: any) => {
                console.log("[MemoryManager] Searching memories:", params);
                return Array.from(storedPatterns.values());
            },
            searchMemoriesByEmbedding: async (
                embedding: number[],
                params: any
            ) => {
                console.log("[MemoryManager] Searching by embedding");
                return Array.from(storedPatterns.values());
            },
            databaseAdapter,
        } as unknown as MemoryManager;

        // Initialize vector operations with OpenAI
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

        // Create runtime
        const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
            databaseAdapter,
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

        // Prepare text for embedding
        const textToEmbed = [
            sourcePattern.pattern_name,
            sourcePattern.type,
            sourcePattern.content.context,
            Array.isArray(sourcePattern.content.implementation.html)
                ? sourcePattern.content.implementation.html.join("\n")
                : sourcePattern.content.implementation.html,
        ].join("\n");

        console.log("\n[Test] Pattern selected for embedding test:");
        console.log("Name:", sourcePattern.pattern_name);
        console.log("Type:", sourcePattern.type);
        console.log("Context:", sourcePattern.content.context);

        // Generate embedding
        console.log("\n[Test] Attempting to generate embedding...");
        const embedding = await vectorOperations.generateEmbedding(textToEmbed);
        console.log("[Test] Embedding generated successfully!");
        console.log("Embedding dimension:", embedding.length);
        console.log("First 5 values:", embedding.slice(0, 5));

        // Create test pattern with embedding
        const testPattern = {
            id: randomUUID(),
            type: sourcePattern.type,
            pattern_name: sourcePattern.pattern_name,
            content: sourcePattern.content,
            embedding: embedding,
            effectiveness_score: 0.0,
            usage_count: 0,
        };

        // Store pattern
        console.log("\n[Test] Attempting to store pattern...");
        console.log("Pattern ID:", testPattern.id);
        console.log("Embedding dimension:", testPattern.embedding.length);

        await vectorDb.storePattern(testPattern);
        console.log("[Test] Pattern stored successfully");

        // Verify storage
        console.log("\n[Test] Verifying pattern storage...");
        const storedPattern = await vectorDb.getPatternById(testPattern.id);
        if (!storedPattern) {
            throw new Error("Failed to retrieve stored pattern");
        }
        console.log("[Test] Pattern retrieved successfully");
        console.log("Retrieved pattern ID:", storedPattern.id);
        console.log(
            "Retrieved embedding dimension:",
            storedPattern.embedding.length
        );

        console.log("\n[Test] All tests completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n[Test] Test failed:", error);
        process.exit(1);
    }
}

// Run the test
console.log("[Test] Starting embedding generation test...");
console.log("[Test] Node version:", process.version);
console.log("[Test] Current working directory:", process.cwd());
testEmbeddingGeneration();
