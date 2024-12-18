import { VectorDatabase } from "../services/VectorDatabase";
import { GamePattern } from "../types/patterns";
import { formatDistance } from "date-fns";
import {
    DatabaseAdapter,
    IAgentRuntime,
    elizaLogger,
    Memory,
} from "@ai16z/eliza";
import { PostgresDatabaseAdapter } from "@ai16z/adapter-postgres";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function createTestPattern(db: VectorDatabase) {
    const testPattern: GamePattern = {
        id: crypto.randomUUID(),
        type: "ui",
        pattern_name: "Test Pattern",
        content: {
            html: "<div>Test Pattern</div>",
            context: "Testing database connection",
            metadata: {
                test: true,
                timestamp: new Date().toISOString(),
            },
        },
        embedding: `[${new Array(1536).fill(0.1).join(",")}]`,
        effectiveness_score: 0.5,
        usage_count: 0,
        created_at: new Date().toISOString(),
    };

    try {
        await db.storePattern(testPattern);
        console.log("\nSuccessfully stored test pattern:", testPattern.id);
    } catch (error) {
        console.error("Error storing test pattern:", error);
        throw error;
    }
}

async function listPatterns() {
    try {
        // Initialize PostgreSQL database adapter
        const databaseAdapter = new PostgresDatabaseAdapter({
            connectionString: process.env.DATABASE_URL,
        });

        // Create runtime with PostgreSQL
        const runtime: IAgentRuntime & { logger: typeof elizaLogger } = {
            databaseAdapter,
            logger: elizaLogger,
            embeddingCache: {
                get: async () => null,
                set: async () => {},
                delete: async () => {},
            },
            vectorOperations: {
                initialize: async () => {},
                generateEmbedding: async () => new Array(1536).fill(0.1),
            },
            getMemoryManager: () => ({
                initialize: async () => {},
                createMemory: async (memory: Memory) => {
                    await databaseAdapter.query(
                        `INSERT INTO vector_patterns (id, content, embedding, room_id, user_id, agent_id)
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
                        `SELECT * FROM vector_patterns WHERE id = $1`,
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
                              tableName: "vector_patterns",
                              createdAt: result.rows[0].created_at.getTime(),
                          }
                        : null;
                },
                getMemories: async () => {
                    const result = await databaseAdapter.query(
                        `SELECT * FROM vector_patterns ORDER BY created_at DESC LIMIT 10`
                    );
                    return result.rows.map((row) => ({
                        id: row.id,
                        content: row.content,
                        embedding: row.embedding,
                        roomId: row.room_id,
                        userId: row.user_id,
                        agentId: row.agent_id,
                        tableName: "vector_patterns",
                        createdAt: row.created_at.getTime(),
                    }));
                },
                updateMemory: async (memory: Memory) => {
                    await databaseAdapter.query(
                        `UPDATE vector_patterns
                         SET content = $2, embedding = $3
                         WHERE id = $1`,
                        [memory.id, memory.content, memory.embedding]
                    );
                },
                searchMemoriesByEmbedding: async () => [],
            }),
        };

        const db = new VectorDatabase();
        await db.initialize(runtime);

        // Create a test pattern
        await createTestPattern(db);

        // List all patterns
        const patterns = await db.listStoredPatterns();

        if (!patterns || patterns.length === 0) {
            console.log("\nNo patterns found in database.");
            return;
        }

        console.log("\nStored Game Patterns:");
        console.log("====================\n");

        patterns.forEach((pattern: GamePattern, index: number) => {
            console.log(
                `${index + 1}. ${pattern.pattern_name || "Unnamed Pattern"}`
            );
            console.log(`   ID: ${pattern.id}`);
            console.log(`   Type: ${pattern.type}`);
            if (pattern.created_at) {
                console.log(
                    `   Created: ${formatDistance(new Date(pattern.created_at), new Date(), { addSuffix: true })}`
                );
            }
            console.log(
                `   Effectiveness Score: ${pattern.effectiveness_score}`
            );
            console.log(`   Usage Count: ${pattern.usage_count}`);

            if (pattern.content?.context) {
                console.log(`   Context: ${pattern.content.context}`);
            }

            if (pattern.content?.metadata) {
                console.log("   Metadata:");
                Object.entries(pattern.content.metadata).forEach(
                    ([key, value]) => {
                        console.log(`     ${key}: ${JSON.stringify(value)}`);
                    }
                );
            }

            if (pattern.embedding) {
                console.log(
                    `   Embedding: [${pattern.embedding.slice(0, 3).join(", ")}...]`
                );
            }

            console.log("\n");
        });
    } catch (error) {
        console.error("Error listing patterns:", error);
        if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Stack trace:", error.stack);
        }
    }
}

// Run the function
listPatterns().catch(console.error);

export { listPatterns };
