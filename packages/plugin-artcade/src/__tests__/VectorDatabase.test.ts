import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VectorDatabase } from "../services/VectorDatabase";
import { DatabaseTestHelper } from "./helpers/DatabaseTestHelper";
import { DatabaseAdapter, MemoryManager, Memory, UUID } from "@ai16z/eliza";

// Define local types for testing
interface EmbeddingCache {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
    initialize: () => Promise<void>;
}

interface VectorOperations {
    initialize: (config: any) => Promise<void>;
    store: (id: string, embedding: number[]) => Promise<void>;
    findSimilar: (embedding: number[], limit?: number) => Promise<any[]>;
}

describe("VectorDatabase", () => {
    let db: VectorDatabase;
    let mockRuntime: any;
    let mockDatabaseAdapter: DatabaseAdapter<any>;
    let mockEmbeddingCache: jest.Mocked<EmbeddingCache>;
    let mockVectorOps: jest.Mocked<VectorOperations>;
    let mockMemoryManager: jest.Mocked<MemoryManager>;

    beforeEach(async () => {
        // Setup mock database adapter with all required methods
        mockDatabaseAdapter = {
            query: vi.fn().mockResolvedValue({ rows: [] }),
            transaction: vi.fn(async (callback) =>
                callback(mockDatabaseAdapter)
            ),
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
            getMemoryById: vi.fn(),
            createMemory: vi.fn(),
            updateMemory: vi.fn(),
            deleteMemory: vi.fn(),
            searchMemories: vi.fn(),
            searchMemoriesByEmbedding: vi.fn(),
            circuitBreaker: {
                execute: vi.fn(),
            },
            withCircuitBreaker: vi.fn(),
        } as unknown as DatabaseAdapter<any>;

        // Setup mock memory manager with complete interface
        mockMemoryManager = {
            createMemory: vi.fn().mockImplementation(async (memory: Memory) => {
                return { id: memory.id };
            }),
            getMemory: vi.fn().mockImplementation(async (id: UUID) => {
                return {
                    id,
                    content: {
                        text: JSON.stringify({
                            type: "test",
                            pattern_name: "test",
                            data: {},
                            effectiveness_score: 0,
                            usage_count: 0,
                        }),
                        attachments: [],
                    },
                    embedding: new Array(1536).fill(0),
                    userId: "system" as UUID,
                    roomId: "patterns" as UUID,
                    agentId: "artcade" as UUID,
                    createdAt: Date.now(),
                };
            }),
            getMemories: vi.fn().mockResolvedValue([]),
            updateMemory: vi.fn().mockResolvedValue(undefined),
            deleteMemory: vi.fn().mockResolvedValue(undefined),
            searchMemoriesByEmbedding: vi
                .fn()
                .mockImplementation(async () => []),
            initialize: vi.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<MemoryManager>;

        // Setup mock embedding cache
        mockEmbeddingCache = {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            initialize: vi.fn(),
        } as unknown as jest.Mocked<EmbeddingCache>;

        // Setup mock vector operations
        mockVectorOps = {
            initialize: vi.fn().mockResolvedValue(undefined),
            store: vi.fn(),
            findSimilar: vi.fn(),
        } as unknown as jest.Mocked<VectorOperations>;

        // Setup mock runtime with complete dependencies
        mockRuntime = {
            databaseAdapter: mockDatabaseAdapter,
            embeddingCache: mockEmbeddingCache,
            vectorOperations: mockVectorOps,
            memoryManager: mockMemoryManager,
            getMemoryManager: vi.fn().mockReturnValue(mockMemoryManager),
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
            },
        };

        // Initialize database with mocked dependencies
        db = new VectorDatabase();
        await db.initialize(mockRuntime);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe("Initialization", () => {
        it("should initialize successfully with all dependencies", async () => {
            expect(mockRuntime.getMemoryManager()).toBeDefined();
            expect(mockRuntime.vectorOperations).toBeDefined();
            expect(mockRuntime.databaseAdapter).toBeDefined();
            expect(mockMemoryManager.initialize).toHaveBeenCalled();
        });

        it("should setup database schema", async () => {
            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    "CREATE TABLE IF NOT EXISTS game_patterns"
                )
            );
        });

        it("should setup audit logging", async () => {
            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    "CREATE TABLE IF NOT EXISTS pattern_audit_logs"
                )
            );
        });

        it("should initialize vector operations", async () => {
            expect(mockVectorOps.initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    tableName: "game_patterns",
                    embeddingColumn: "embedding",
                    dimension: 1536,
                    distanceMetric: "cosine",
                })
            );
        });
    });

    describe("Pattern Management", () => {
        it("should store patterns using memory manager", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            await db.storePattern(pattern);

            expect(mockMemoryManager.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: pattern.id,
                    content: expect.objectContaining({
                        text: expect.any(String),
                    }),
                    embedding: pattern.embedding,
                    tableName: "game_patterns",
                })
            );
        });

        it("should validate embedding dimensions when storing patterns", async () => {
            const invalidPattern = await DatabaseTestHelper.createTestPattern(
                mockDatabaseAdapter,
                {
                    embedding: new Array(512).fill(0),
                }
            );

            await expect(db.storePattern(invalidPattern)).rejects.toThrow(
                "Invalid embedding dimension: 512"
            );
            expect(mockMemoryManager.createMemory).not.toHaveBeenCalled();
        });

        it("should handle unique constraint violations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            mockMemoryManager.createMemory.mockRejectedValueOnce({
                code: "23505",
                message: "Unique violation",
            });

            await expect(db.storePattern(pattern)).rejects.toThrow(
                "Store with features failed"
            );
        });
    });

    describe("Pattern Retrieval", () => {
        it("should get pattern by id using memory manager", async () => {
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockMemory: Memory = {
                id: mockPattern.id as UUID,
                content: {
                    text: JSON.stringify({
                        type: mockPattern.type,
                        pattern_name: mockPattern.pattern_name,
                        data: mockPattern.content,
                        effectiveness_score: mockPattern.effectiveness_score,
                        usage_count: mockPattern.usage_count,
                    }),
                    attachments: [],
                },
                embedding: mockPattern.embedding,
                tableName: "game_patterns",
                userId: "system" as UUID,
                roomId: "patterns" as UUID,
                agentId: "artcade" as UUID,
                createdAt: Date.now(),
            };

            mockMemoryManager.getMemory.mockResolvedValueOnce(mockMemory);

            const result = await db.getPatternById(mockPattern.id);
            expect(result).toBeDefined();
            expect(result.id).toBe(mockPattern.id);
            expect(mockMemoryManager.getMemory).toHaveBeenCalledWith(
                mockPattern.id,
                "game_patterns"
            );
        });

        it("should handle non-existent patterns", async () => {
            mockMemoryManager.getMemory.mockResolvedValueOnce(null);
            const result = await db.getPatternById("non-existent-id");
            expect(result).toBeNull();
        });

        it("should use memory manager for pattern search", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockMemory: Memory = {
                id: mockPattern.id as UUID,
                content: {
                    text: JSON.stringify({
                        type: mockPattern.type,
                        pattern_name: mockPattern.pattern_name,
                        data: mockPattern.content,
                        effectiveness_score: mockPattern.effectiveness_score,
                        usage_count: mockPattern.usage_count,
                    }),
                    attachments: [],
                },
                embedding: mockPattern.embedding,
                tableName: "game_patterns",
                userId: "system" as UUID,
                roomId: "patterns" as UUID,
                agentId: "artcade" as UUID,
                createdAt: Date.now(),
                similarity: 0.95,
            };

            mockMemoryManager.searchMemoriesByEmbedding.mockResolvedValueOnce([
                mockMemory,
            ]);

            const results = await db.findSimilarPatterns(
                mockEmbedding,
                "animation"
            );

            expect(
                mockMemoryManager.searchMemoriesByEmbedding
            ).toHaveBeenCalledWith(
                mockEmbedding,
                expect.objectContaining({
                    match_threshold: 0.85,
                    tableName: "game_patterns",
                    filter: { type: "animation" },
                })
            );
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.95);
        });
    });
});
