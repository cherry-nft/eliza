import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VectorDatabase } from "../../services/VectorDatabase";
import { DatabaseAdapter, MemoryManager, Memory, UUID } from "@ai16z/eliza";
import { ClaudeUsageContext } from "../../types/effectiveness";

describe("VectorDatabase - Pattern Effectiveness", () => {
    let db: VectorDatabase;
    let mockRuntime: any;
    let mockDatabaseAdapter: DatabaseAdapter<any>;
    let mockMemoryManager: jest.Mocked<MemoryManager>;

    beforeEach(async () => {
        // Setup mock database adapter
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

        // Setup mock memory manager
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

        // Setup mock runtime
        mockRuntime = {
            databaseAdapter: mockDatabaseAdapter,
            embeddingCache: {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
            },
            vectorOperations: {
                initialize: vi.fn(),
                store: vi.fn(),
                findSimilar: vi.fn(),
            },
            getMemoryManager: vi.fn().mockReturnValue(mockMemoryManager),
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
    });

    describe("trackClaudeUsage", () => {
        it("should track Claude's usage of patterns", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create a game with collision detection",
                generated_html: "<div>Game content</div>",
                matched_patterns: [
                    {
                        pattern_id: "test-id",
                        similarity: 0.9,
                        features_used: ["collision", "animation"],
                    },
                ],
                quality_assessment: {
                    visual: 0.8,
                    interactive: 0.7,
                    functional: 0.9,
                    performance: 0.85,
                },
            };

            await db.trackClaudeUsage(context);

            // Verify memory updates
            expect(mockMemoryManager.getMemory).toHaveBeenCalledWith(
                "test-id",
                "game_patterns"
            );
            expect(mockMemoryManager.updateMemory).toHaveBeenCalled();
        });

        it("should handle multiple pattern matches", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create a game with multiple features",
                generated_html: "<div>Game content</div>",
                matched_patterns: [
                    {
                        pattern_id: "pattern1",
                        similarity: 0.85,
                        features_used: ["movement"],
                    },
                    {
                        pattern_id: "pattern2",
                        similarity: 0.75,
                        features_used: ["scoring"],
                    },
                ],
                quality_assessment: {
                    visual: 0.7,
                    interactive: 0.8,
                    functional: 0.75,
                    performance: 0.8,
                },
            };

            await db.trackClaudeUsage(context);

            // Verify both patterns were updated
            expect(mockMemoryManager.getMemory).toHaveBeenCalledTimes(2);
            expect(mockMemoryManager.updateMemory).toHaveBeenCalledTimes(2);
        });

        it("should update effectiveness scores correctly", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create a high-performance game",
                generated_html: "<div>Game content</div>",
                matched_patterns: [
                    {
                        pattern_id: "test-id",
                        similarity: 0.95,
                        features_used: ["optimization"],
                    },
                ],
                quality_assessment: {
                    visual: 1.0,
                    interactive: 0.9,
                    functional: 0.95,
                    performance: 1.0,
                },
            };

            await db.trackClaudeUsage(context);

            // Verify score calculation
            const expectedScore = (1.0 + 0.9 + 0.95 + 1.0) / 4;
            expect(mockMemoryManager.updateMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        text: expect.stringContaining(
                            `"effectiveness_score":${expectedScore}`
                        ),
                    }),
                })
            );
        });

        it("should extract keywords correctly from prompt", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create an interactive game with collision detection and power-ups",
                generated_html: "<div>Game content</div>",
                matched_patterns: [
                    {
                        pattern_id: "test-id",
                        similarity: 0.8,
                        features_used: ["collision", "power-ups"],
                    },
                ],
                quality_assessment: {
                    visual: 0.8,
                    interactive: 0.9,
                    functional: 0.85,
                    performance: 0.8,
                },
            };

            await db.trackClaudeUsage(context);

            // Verify keyword extraction in audit log
            expect(mockDatabaseAdapter.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO pattern_audit_logs"),
                expect.arrayContaining([
                    "CLAUDE_USAGE",
                    "test-id",
                    expect.objectContaining({
                        features_used: ["collision", "power-ups"],
                        prompt_keywords: expect.arrayContaining([
                            "create",
                            "interactive",
                            "game",
                            "collision",
                            "detection",
                            "power-ups",
                        ]),
                        quality_scores: expect.any(Object),
                        similarity: 0.8,
                    }),
                    expect.any(Date),
                ])
            );
        });
    });
});
