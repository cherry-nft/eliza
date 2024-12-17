import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VectorDatabase } from "../services/VectorDatabase";
import { DatabaseTestHelper } from "./helpers/DatabaseTestHelper";
import {
    DatabaseAdapter,
    DatabaseError,
    EmbeddingCache,
    VectorOperations,
} from "@ai16z/eliza";

describe("VectorDatabase", () => {
    let db: VectorDatabase;
    let mockRuntime: any;
    let mockDatabaseAdapter: DatabaseAdapter<any>;
    let mockEmbeddingCache: jest.Mocked<EmbeddingCache>;
    let mockVectorOps: jest.Mocked<VectorOperations>;

    beforeEach(async () => {
        // Setup mock embedding cache
        mockEmbeddingCache = {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            initialize: vi.fn(),
        } as unknown as jest.Mocked<EmbeddingCache>;

        // Setup mock vector operations
        mockVectorOps = {
            initialize: vi.fn(),
            store: vi.fn(),
            findSimilar: vi.fn(),
        } as unknown as jest.Mocked<VectorOperations>;

        // Setup mock database adapter
        mockDatabaseAdapter = {
            query: vi.fn().mockResolvedValue({ rows: [] }),
            transaction: vi.fn(async (callback) => {
                return callback(mockDatabaseAdapter);
            }),
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
        } as unknown as DatabaseAdapter<any>;

        // Setup mock runtime with spies
        mockRuntime = {
            getDatabaseAdapter: vi.fn().mockReturnValue(mockDatabaseAdapter),
            getEmbeddingCache: vi.fn().mockReturnValue(mockEmbeddingCache),
            getVectorOperations: vi.fn().mockReturnValue(mockVectorOps),
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
            },
        };

        // Initialize database
        db = new VectorDatabase();
        await db.initialize(mockRuntime);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe("Eliza Infrastructure Integration", () => {
        it("should use runtime's embedding cache", async () => {
            expect(mockRuntime.getEmbeddingCache).toHaveBeenCalled();
            expect(mockRuntime.getVectorOperations).toHaveBeenCalled();
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

        it("should use embedding cache for pattern retrieval", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockCacheResult = [
                {
                    pattern: mockPattern,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(mockCacheResult);

            const results = await db.findSimilarPatterns(
                mockEmbedding,
                "animation"
            );

            expect(mockEmbeddingCache.get).toHaveBeenCalledWith(
                `animation_${mockEmbedding.join(",")}`
            );
            expect(results).toEqual(mockCacheResult);
            expect(mockVectorOps.findSimilar).not.toHaveBeenCalled();
        });

        it("should fall back to vector operations when cache misses", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockSearchResult = [
                {
                    id: mockPattern.id,
                    type: mockPattern.type,
                    pattern_name: mockPattern.pattern_name,
                    content: mockPattern.content,
                    embedding: mockPattern.embedding,
                    effectiveness_score: mockPattern.effectiveness_score,
                    usage_count: mockPattern.usage_count,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            const results = await db.findSimilarPatterns(
                mockEmbedding,
                "animation"
            );

            expect(mockEmbeddingCache.get).toHaveBeenCalled();
            expect(mockVectorOps.findSimilar).toHaveBeenCalledWith(
                expect.objectContaining({
                    embedding: mockEmbedding,
                    filter: { type: "animation" },
                })
            );
            expect(mockEmbeddingCache.set).toHaveBeenCalled();
        });

        it("should validate embedding dimensions when storing patterns", async () => {
            const invalidPattern = await DatabaseTestHelper.createTestPattern(
                mockDatabaseAdapter,
                { embedding: new Array(512).fill(0) }
            );

            await expect(db.storePattern(invalidPattern)).rejects.toThrow(
                "Invalid embedding dimension: 512"
            );
            expect(mockVectorOps.store).not.toHaveBeenCalled();
        });

        it("should clear type-specific cache entries when storing new patterns", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            mockVectorOps.store.mockResolvedValueOnce(undefined);

            await db.storePattern(pattern);

            expect(mockEmbeddingCache.delete).toHaveBeenCalledWith(
                `${pattern.type}_*`
            );
        });

        it("should handle vector operation errors gracefully", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            mockVectorOps.findSimilar.mockRejectedValueOnce(
                new Error("Vector operation failed")
            );

            await expect(
                db.findSimilarPatterns(mockEmbedding, "animation")
            ).rejects.toThrow("Vector operation failed");

            expect(mockRuntime.logger.error).toHaveBeenCalledWith(
                "Failed to find similar patterns",
                expect.any(Object)
            );
        });
    });

    describe("Transaction Management", () => {
        it("should commit successful operations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            mockVectorOps.store.mockResolvedValueOnce(undefined);

            await db.storePattern(pattern);

            expect(mockDatabaseAdapter.transaction).toHaveBeenCalled();
            expect(mockVectorOps.store).toHaveBeenCalled();
        });

        it("should rollback on error", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            mockVectorOps.store.mockRejectedValueOnce(
                new Error("Store failed")
            );

            await expect(db.storePattern(pattern)).rejects.toThrow(
                "Store failed"
            );
            expect(mockDatabaseAdapter.transaction).toHaveBeenCalled();
        });

        it("should handle unique constraint violations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            mockVectorOps.store.mockRejectedValueOnce({
                code: "23505",
                message: "Unique violation",
            });

            await expect(db.storePattern(pattern)).rejects.toThrow(
                DatabaseError
            );
            expect(mockDatabaseAdapter.transaction).toHaveBeenCalled();
        });
    });

    describe("Caching", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it("should cache patterns after retrieval", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockSearchResult = [
                {
                    id: mockPattern.id,
                    type: mockPattern.type,
                    pattern_name: mockPattern.pattern_name,
                    content: mockPattern.content,
                    embedding: mockPattern.embedding,
                    effectiveness_score: mockPattern.effectiveness_score,
                    usage_count: mockPattern.usage_count,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            await db.findSimilarPatterns(mockEmbedding, "animation");
            expect(mockEmbeddingCache.set).toHaveBeenCalled();
        });

        it("should respect cache TTL", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockSearchResult = [
                {
                    id: mockPattern.id,
                    type: mockPattern.type,
                    pattern_name: mockPattern.pattern_name,
                    content: mockPattern.content,
                    embedding: mockPattern.embedding,
                    effectiveness_score: mockPattern.effectiveness_score,
                    usage_count: mockPattern.usage_count,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            await db.findSimilarPatterns(mockEmbedding, "animation");
            expect(mockEmbeddingCache.set).toHaveBeenCalled();

            // Fast-forward time past TTL
            vi.advanceTimersByTime(301000); // 5 minutes + 1 second

            // Should hit database again after TTL
            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            await db.findSimilarPatterns(mockEmbedding, "animation");
            expect(mockVectorOps.findSimilar).toHaveBeenCalledTimes(2);
        });
    });

    describe("Vector Search", () => {
        it("should find similar patterns", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockSearchResult = [
                {
                    id: mockPattern.id,
                    type: mockPattern.type,
                    pattern_name: mockPattern.pattern_name,
                    content: mockPattern.content,
                    embedding: mockPattern.embedding,
                    effectiveness_score: mockPattern.effectiveness_score,
                    usage_count: mockPattern.usage_count,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            const results = await db.findSimilarPatterns(
                mockEmbedding,
                "animation"
            );
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.95);
        });

        it("should respect similarity threshold", async () => {
            const mockEmbedding = new Array(1536).fill(0);
            const mockPattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const mockSearchResult = [
                {
                    id: mockPattern.id,
                    type: mockPattern.type,
                    pattern_name: mockPattern.pattern_name,
                    content: mockPattern.content,
                    embedding: mockPattern.embedding,
                    effectiveness_score: mockPattern.effectiveness_score,
                    usage_count: mockPattern.usage_count,
                    similarity: 0.95,
                },
            ];

            mockEmbeddingCache.get.mockResolvedValueOnce(null);
            mockVectorOps.findSimilar.mockResolvedValueOnce(mockSearchResult);

            const results = await db.findSimilarPatterns(
                mockEmbedding,
                "animation",
                0.9
            );
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBeGreaterThan(0.9);
        });
    });
});
