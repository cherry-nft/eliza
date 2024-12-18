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
        const testPattern = patterns[0]; // Use the first pattern

        // Initialize runtime dependencies
        const databaseAdapter = new DatabaseAdapter({
            connectionString: SERVER_CONFIG.DATABASE_URL,
            schema: "public",
        });

        const memoryManager = new MemoryManager(databaseAdapter);

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

        // Prepare text for embedding
        const textToEmbed = [
            testPattern.pattern_name,
            testPattern.type,
            testPattern.content.context,
            Array.isArray(testPattern.content.implementation.html)
                ? testPattern.content.implementation.html.join("\n")
                : testPattern.content.implementation.html,
        ].join("\n");

        console.log("\n[Test] Pattern selected for embedding test:");
        console.log("Name:", testPattern.pattern_name);
        console.log("Type:", testPattern.type);
        console.log("Context:", testPattern.content.context);

        // Generate embedding
        console.log("\n[Test] Attempting to generate embedding...");
        const embedding = await vectorOperations.generateEmbedding(textToEmbed);

        console.log("\n[Test] Embedding generated successfully!");
        console.log("Embedding dimension:", embedding.length);
        console.log("First 5 values:", embedding.slice(0, 5));

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
