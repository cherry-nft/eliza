import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { VectorDatabase } from "../services/VectorDatabase";
import { GamePattern } from "../services/PatternStaging";
import { Pool } from "pg";

// Mock pg Pool
vi.mock("pg", () => {
    const Pool = vi.fn(() => ({
        query: vi.fn(),
        end: vi.fn(),
    }));
    return { Pool };
});

describe("VectorDatabase", () => {
    let vectorDb: VectorDatabase;
    let mockRuntime: IAgentRuntime & { logger: typeof elizaLogger };
    let mockPool: any;

    const mockPattern: GamePattern = {
        id: "test-id",
        type: "animation",
        pattern_name: "test_animation",
        content: {
            html: "<div class='animated'>Test</div>",
            css: "@keyframes test { }",
            context: "test",
            metadata: {
                visual_type: "animation",
                animation_duration: "1s",
            },
        },
        embedding: new Array(1536).fill(0),
        effectiveness_score: 1.0,
        usage_count: 0,
    };

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock pool
        mockPool = {
            query: vi.fn(),
            end: vi.fn(),
        };
        (Pool as any).mockImplementation(() => mockPool);

        // Setup mock runtime
        mockRuntime = {
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            },
            getService: vi.fn(),
        } as unknown as IAgentRuntime & { logger: typeof elizaLogger };

        // Initialize database
        vectorDb = new VectorDatabase();
        await vectorDb.initialize(mockRuntime);
    });

    afterEach(async () => {
        await vectorDb.cleanup();
    });

    describe("initialization", () => {
        it("should create required extensions and tables", async () => {
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(/CREATE EXTENSION IF NOT EXISTS vector/)
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(
                    /CREATE TABLE IF NOT EXISTS game_patterns/
                )
            );
        });

        it("should create pattern similarity function", async () => {
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(
                    /CREATE OR REPLACE FUNCTION pattern_similarity/
                )
            );
        });
    });

    describe("storePattern", () => {
        it("should store a pattern correctly", async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await vectorDb.storePattern(mockPattern);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(/INSERT INTO game_patterns/),
                [
                    mockPattern.id,
                    mockPattern.type,
                    mockPattern.pattern_name,
                    mockPattern.content,
                    mockPattern.embedding,
                    mockPattern.effectiveness_score,
                    mockPattern.usage_count,
                ]
            );
        });

        it("should handle errors when storing patterns", async () => {
            const error = new Error("Database error");
            mockPool.query.mockRejectedValueOnce(error);

            await expect(vectorDb.storePattern(mockPattern)).rejects.toThrow();
            expect(mockRuntime.logger.error).toHaveBeenCalled();
        });
    });

    describe("findSimilarPatterns", () => {
        it("should find similar patterns", async () => {
            const mockResult = {
                rows: [
                    {
                        id: "test-id",
                        type: "animation",
                        pattern_name: "test_pattern",
                        content: mockPattern.content,
                        embedding: mockPattern.embedding,
                        effectiveness_score: 1.0,
                        usage_count: 1,
                        similarity: 0.95,
                    },
                ],
            };
            mockPool.query.mockResolvedValueOnce(mockResult);

            const results = await vectorDb.findSimilarPatterns(
                mockPattern.embedding,
                mockPattern.type
            );

            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.95);
            expect(results[0].pattern.type).toBe("animation");
        });

        it("should handle empty results", async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const results = await vectorDb.findSimilarPatterns(
                mockPattern.embedding,
                mockPattern.type
            );

            expect(results).toHaveLength(0);
        });
    });

    describe("updateEffectivenessScore", () => {
        it("should update pattern score", async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await vectorDb.updateEffectivenessScore("test-id", 0.8);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE game_patterns/),
                ["test-id", 0.8]
            );
        });
    });

    describe("incrementUsageCount", () => {
        it("should increment usage count", async () => {
            // Reset mock state
            mockPool.query.mockReset();
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await vectorDb.incrementUsageCount("test-id");

            // Use regex pattern that ignores whitespace
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringMatching(
                    /UPDATE\s+game_patterns\s+SET\s+usage_count\s*=\s*usage_count\s*\+\s*1\s*,\s*last_used\s*=\s*CURRENT_TIMESTAMP\s+WHERE\s+id\s*=\s*\$1/
                ),
                ["test-id"]
            );
        });
    });

    describe("getPatternById", () => {
        it("should retrieve a pattern by id", async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [mockPattern],
            });

            const pattern = await vectorDb.getPatternById("test-id");

            expect(pattern).toBeDefined();
            expect(pattern?.id).toBe("test-id");
            expect(pattern?.type).toBe("animation");
        });

        it("should return null for non-existent pattern", async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const pattern = await vectorDb.getPatternById("non-existent");

            expect(pattern).toBeNull();
        });
    });
});
