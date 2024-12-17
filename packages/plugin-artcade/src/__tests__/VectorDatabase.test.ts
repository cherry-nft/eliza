import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VectorDatabase } from "../services/VectorDatabase";
import { DatabaseTestHelper } from "./helpers/DatabaseTestHelper";
import { DatabaseAdapter, DatabaseError } from "@ai16z/eliza";

describe("VectorDatabase", () => {
    let db: VectorDatabase;
    let mockRuntime: any;
    let mockDatabaseAdapter: DatabaseAdapter<any>;

    beforeEach(async () => {
        // Setup mock database adapter with default responses
        mockDatabaseAdapter = {
            query: vi.fn().mockResolvedValue({ rows: [] }),
            transaction: vi.fn(async (callback) => {
                return callback(mockDatabaseAdapter);
            }),
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
        } as unknown as DatabaseAdapter<any>;

        // Setup mock runtime
        mockRuntime = {
            getDatabaseAdapter: () => mockDatabaseAdapter,
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

        // Clear mock counts after initialization
        mockDatabaseAdapter.query.mockClear();

        // Setup fake timers
        vi.useFakeTimers();
    });

    afterEach(async () => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe("Transaction Management", () => {
        it("should commit successful operations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            await db.storePattern(pattern);

            expect(mockDatabaseAdapter.transaction).toHaveBeenCalled();
            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO game_patterns"),
                expect.arrayContaining([pattern.id])
            );
        });

        it("should rollback on error", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            mockDatabaseAdapter.query.mockRejectedValueOnce(
                new Error("Test error")
            );

            await expect(db.storePattern(pattern)).rejects.toThrow();
            expect(mockDatabaseAdapter.transaction).toHaveBeenCalled();
        });

        it("should handle unique constraint violations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            mockDatabaseAdapter.query.mockRejectedValueOnce({
                code: "23505",
            });

            await expect(db.storePattern(pattern)).rejects.toThrow(
                DatabaseError
            );
            expect(mockRuntime.logger.error).toHaveBeenCalled();
        });
    });

    describe("Caching", () => {
        it("should cache patterns after retrieval", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock the database response for the first call
            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [pattern],
            });

            // First call should hit database
            const result1 = await db.getPatternById(pattern.id);
            expect(result1).toEqual(pattern);
            expect(mockDatabaseAdapter.query).toHaveBeenCalledTimes(1);

            // Reset mock to ensure it's not called again
            mockDatabaseAdapter.query.mockClear();

            // Second call should use cache
            const result2 = await db.getPatternById(pattern.id);
            expect(result2).toEqual(pattern);
            expect(mockDatabaseAdapter.query).not.toHaveBeenCalled();
        });

        it("should respect cache TTL", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock the database response for both calls
            mockDatabaseAdapter.query
                .mockResolvedValueOnce({
                    rows: [pattern],
                })
                .mockResolvedValueOnce({
                    rows: [pattern],
                });

            // First call should hit database
            await db.getPatternById(pattern.id);
            expect(mockDatabaseAdapter.query).toHaveBeenCalledTimes(1);

            // Clear mock counts
            mockDatabaseAdapter.query.mockClear();

            // Fast-forward time past TTL
            vi.advanceTimersByTime(301000); // 5 minutes + 1 second

            // Should hit database again after TTL
            await db.getPatternById(pattern.id);
            expect(mockDatabaseAdapter.query).toHaveBeenCalledTimes(1);
        });
    });

    describe("Audit Logging", () => {
        it("should log pattern operations", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock successful pattern storage
            mockDatabaseAdapter.query.mockResolvedValueOnce({ rows: [] });

            await db.storePattern(pattern);

            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO pattern_audit_logs"),
                expect.arrayContaining(["STORE_PATTERN", pattern.id])
            );
        });

        it("should track pattern usage", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock the increment operation
            mockDatabaseAdapter.query.mockResolvedValueOnce({ rows: [] });

            // Mock the audit log query
            mockDatabaseAdapter.query
                .mockResolvedValueOnce({ rows: [] }) // For increment query
                .mockResolvedValueOnce({
                    // For audit log query
                    rows: [
                        {
                            operation: "INCREMENT_USAGE",
                            pattern_id: pattern.id,
                            metadata: { timestamp: new Date() },
                        },
                    ],
                });

            await db.incrementUsageCount(pattern.id);

            const auditLogs = await DatabaseTestHelper.getAuditLogs(
                mockDatabaseAdapter,
                pattern.id
            );
            expect(auditLogs.length).toBeGreaterThan(0);
            expect(auditLogs[0].operation).toBe("INCREMENT_USAGE");
        });
    });

    describe("Health Checks", () => {
        it("should report healthy status", async () => {
            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [{ "?column?": 1 }],
            });

            const isHealthy = await db.healthCheck();
            expect(isHealthy).toBe(true);
        });

        it("should report unhealthy status on error", async () => {
            mockDatabaseAdapter.query.mockRejectedValueOnce(
                new Error("Connection failed")
            );

            const isHealthy = await db.healthCheck();
            expect(isHealthy).toBe(false);
            expect(mockRuntime.logger.error).toHaveBeenCalled();
        });
    });

    describe("Cleanup Jobs", () => {
        it("should remove unused old patterns", async () => {
            const cutoffDays = 30;

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock the query for patterns to delete
            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [{ id: "test-id-1" }, { id: "test-id-2" }],
            });

            // Mock the deletion operation
            mockDatabaseAdapter.query.mockResolvedValueOnce({ rows: [] });

            await db.cleanupOldPatterns(cutoffDays);

            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining("DELETE FROM game_patterns"),
                expect.any(Array)
            );
        });

        it("should preserve frequently used patterns", async () => {
            const pattern = await DatabaseTestHelper.createTestPattern(
                mockDatabaseAdapter,
                {
                    usage_count: 100,
                }
            );

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            // Mock the query for patterns to delete (empty because of high usage)
            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [],
            });

            await db.cleanupOldPatterns(30);

            // Mock the pattern retrieval
            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [pattern],
            });

            const retrievedPattern = await db.getPatternById(pattern.id);
            expect(retrievedPattern).toBeTruthy();
        });
    });

    describe("Vector Search", () => {
        it("should find similar patterns", async () => {
            const pattern =
                await DatabaseTestHelper.createTestPattern(mockDatabaseAdapter);
            const embedding = Array(1536).fill(0.1);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            mockDatabaseAdapter.query.mockResolvedValueOnce({
                rows: [
                    {
                        ...pattern,
                        similarity: 0.95,
                    },
                ],
            });

            const results = await db.findSimilarPatterns(
                embedding,
                "animation"
            );
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.95);
            expect(results[0].pattern.type).toBe("animation");
        });

        it("should respect similarity threshold", async () => {
            const embedding = Array(1536).fill(0.1);

            // Reset mock to start fresh
            mockDatabaseAdapter.query.mockReset();

            mockDatabaseAdapter.query.mockResolvedValueOnce({ rows: [] });

            const results = await db.findSimilarPatterns(
                embedding,
                "animation",
                0.99
            );
            expect(results).toHaveLength(0);
        });
    });
});
