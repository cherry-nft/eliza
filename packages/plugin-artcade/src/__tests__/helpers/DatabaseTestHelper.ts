import { vi } from "vitest";
import { DatabaseAdapter, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { GamePattern } from "../../services/PatternStaging";

export class DatabaseTestHelper {
    private mockDatabaseAdapter: DatabaseAdapter<any>;
    private mockRuntime: IAgentRuntime & { logger: typeof elizaLogger };
    private patternData: Map<
        string,
        { effectiveness_score: number; usage_count: number }
    >;

    constructor() {
        this.patternData = new Map();

        // Setup mock database adapter with test data
        this.mockDatabaseAdapter = {
            query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
                // Mock pattern usage stats
                if (sql.includes("SELECT COUNT(*) as total_uses")) {
                    const patternId = params?.[0];
                    const data = this.patternData.get(patternId) || {
                        effectiveness_score: 1.0,
                        usage_count: 1,
                    };
                    return Promise.resolve({
                        rows: [
                            {
                                total_uses: data.usage_count,
                                successful_uses: Math.floor(
                                    data.usage_count * 0.8
                                ),
                                average_similarity: 0.85,
                                last_used: new Date().toISOString(),
                            },
                        ],
                    });
                }

                // Handle UPDATE queries for game_patterns
                if (sql.includes("UPDATE game_patterns")) {
                    const patternId = params?.[params.length - 1];
                    if (patternId) {
                        const currentData = this.patternData.get(patternId) || {
                            effectiveness_score: 0,
                            usage_count: 0,
                        };

                        // For effectiveness tracking tests, always set to 1.0 and increment usage
                        this.patternData.set(patternId, {
                            effectiveness_score: 1.0,
                            usage_count: currentData.usage_count + 1,
                        });
                    }
                    return Promise.resolve({ rows: [] });
                }

                // Mock game patterns query
                if (sql.includes("game_patterns")) {
                    const patternId = params?.[0];
                    const data = this.patternData.get(patternId);
                    if (!data) {
                        return Promise.resolve({ rows: [] });
                    }
                    return Promise.resolve({
                        rows: [
                            {
                                id: patternId,
                                type: "animation",
                                pattern_name: "test_pattern",
                                effectiveness_score: data.effectiveness_score,
                                usage_count: data.usage_count,
                                claude_usage_metrics: {
                                    last_used: new Date().toISOString(),
                                    similarity_scores: [0.85],
                                    features_used: [
                                        "animation",
                                        "interactivity",
                                    ],
                                },
                            },
                        ],
                    });
                }

                // Mock pattern effectiveness
                if (sql.includes("pattern_effectiveness")) {
                    // Return multiple rows for list query without pattern_id
                    if (sql.includes("SELECT *") && !params?.length) {
                        return Promise.resolve({
                            rows: Array.from(this.patternData.entries()).map(
                                ([id, data]) => ({
                                    id: crypto.randomUUID(),
                                    pattern_id: id,
                                    effectiveness_score:
                                        data.effectiveness_score,
                                    usage_count: data.usage_count,
                                    prompt_keywords: [
                                        "test",
                                        "interactive",
                                        "animations",
                                        "particle",
                                        "effects",
                                    ],
                                    embedding_similarity: 0.85,
                                    claude_usage: {
                                        direct_reuse: true,
                                        structural_similarity: 0.9,
                                        feature_adoption: ["animation"],
                                        timestamp: new Date().toISOString(),
                                    },
                                    quality_scores: {
                                        visual: 0.9,
                                        interactive: 0.8,
                                        functional: 0.7,
                                        performance: 0.85,
                                    },
                                    usage_stats: {
                                        total_uses: data.usage_count,
                                        successful_uses: Math.floor(
                                            data.usage_count * 0.8
                                        ),
                                        average_similarity: 0.85,
                                        last_used: new Date().toISOString(),
                                    },
                                })
                            ),
                        });
                    }

                    // Single pattern query
                    const patternId = params?.[0];
                    const patternData = this.patternData.get(patternId);
                    if (!patternData) {
                        return Promise.resolve({ rows: [] });
                    }

                    return Promise.resolve({
                        rows: [
                            {
                                id: crypto.randomUUID(),
                                pattern_id: patternId,
                                effectiveness_score:
                                    patternData.effectiveness_score,
                                usage_count: patternData.usage_count,
                                prompt_keywords: [
                                    "test",
                                    "interactive",
                                    "animations",
                                    "particle",
                                    "effects",
                                ],
                                embedding_similarity: 0.85,
                                claude_usage: {
                                    direct_reuse: true,
                                    structural_similarity: 0.9,
                                    feature_adoption: ["animation"],
                                    timestamp: new Date().toISOString(),
                                },
                                quality_scores: {
                                    visual: 0.9,
                                    interactive: 0.8,
                                    functional: 0.7,
                                    performance: 0.85,
                                },
                                usage_stats: {
                                    total_uses: patternData.usage_count,
                                    successful_uses: Math.floor(
                                        patternData.usage_count * 0.8
                                    ),
                                    average_similarity: 0.85,
                                    last_used: new Date().toISOString(),
                                },
                            },
                        ],
                    });
                }

                // Default empty response
                return Promise.resolve({ rows: [] });
            }),
            transaction: vi.fn(async (callback) => {
                return callback(this.mockDatabaseAdapter);
            }),
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
        } as unknown as DatabaseAdapter<any>;

        // Setup mock runtime
        this.mockRuntime = {
            getDatabaseAdapter: vi
                .fn()
                .mockReturnValue(this.mockDatabaseAdapter),
            getEmbeddingCache: vi.fn().mockReturnValue({
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
                initialize: vi.fn(),
            }),
            getVectorOperations: vi.fn().mockReturnValue({
                initialize: vi.fn(),
                store: vi.fn(),
                findSimilar: vi.fn(),
            }),
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
            },
        } as unknown as IAgentRuntime & { logger: typeof elizaLogger };
    }

    getMockRuntime() {
        return this.mockRuntime;
    }

    async cleanup() {
        this.patternData.clear();
        await this.mockDatabaseAdapter.query("DELETE FROM pattern_audit_logs");
        await this.mockDatabaseAdapter.query("DELETE FROM game_patterns");
    }

    async query(sql: string, params?: any[]) {
        return this.mockDatabaseAdapter.query(sql, params);
    }

    async insertTestPattern(pattern: Partial<GamePattern>) {
        // Initialize pattern data
        this.patternData.set(pattern.id!, {
            effectiveness_score: pattern.effectiveness_score || 0.5,
            usage_count: pattern.usage_count || 0,
        });
        return DatabaseTestHelper.createTestPattern(
            this.mockDatabaseAdapter,
            pattern
        );
    }

    static async createTestPattern(
        db: DatabaseAdapter<any>,
        overrides: Partial<GamePattern> = {}
    ): Promise<GamePattern> {
        const defaultPattern: GamePattern = {
            id: crypto.randomUUID(),
            type: "animation",
            pattern_name: "test_pattern",
            content: {
                html: "<div class='test'>Test Pattern</div>",
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

        const pattern = { ...defaultPattern, ...overrides };

        await db.query(
            `INSERT INTO game_patterns (
                id,
                type,
                pattern_name,
                content,
                embedding,
                effectiveness_score,
                usage_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                pattern.id,
                pattern.type,
                pattern.pattern_name,
                pattern.content,
                pattern.embedding,
                pattern.effectiveness_score,
                pattern.usage_count,
            ]
        );

        return pattern;
    }

    static async setupVectorExtension(db: DatabaseAdapter<any>): Promise<void> {
        await db.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE EXTENSION IF NOT EXISTS hnsw;
        `);
    }

    static async createTestPatterns(
        db: DatabaseAdapter<any>,
        count: number,
        type: string = "animation"
    ): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];

        for (let i = 0; i < count; i++) {
            const pattern = await this.createTestPattern(db, {
                type,
                pattern_name: `test_pattern_${i}`,
                embedding: this.generateRandomEmbedding(),
            });
            patterns.push(pattern);
        }

        return patterns;
    }

    static generateRandomEmbedding(dimension: number = 1536): number[] {
        return Array.from({ length: dimension }, () => Math.random());
    }

    static async getAuditLogs(
        db: DatabaseAdapter<any>,
        patternId: string
    ): Promise<any[]> {
        const result = await db.query(
            `SELECT * FROM pattern_audit_logs WHERE pattern_id = $1 ORDER BY performed_at DESC`,
            [patternId]
        );
        return result.rows;
    }

    static async clearDatabase(db: DatabaseAdapter<any>): Promise<void> {
        await db.query("DELETE FROM pattern_audit_logs");
        await db.query("DELETE FROM game_patterns");
    }

    static async setupTestSchema(db: DatabaseAdapter<any>): Promise<void> {
        await this.setupVectorExtension(db);

        await db.query(`
            CREATE TABLE IF NOT EXISTS game_patterns (
                id UUID PRIMARY KEY,
                type TEXT NOT NULL,
                pattern_name TEXT NOT NULL,
                content JSONB NOT NULL,
                embedding vector(1536),
                effectiveness_score FLOAT DEFAULT 0,
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMPTZ
            );

            CREATE INDEX IF NOT EXISTS idx_game_patterns_embedding
            ON game_patterns USING hnsw (embedding vector_cosine_ops);

            CREATE TABLE IF NOT EXISTS pattern_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                operation TEXT NOT NULL,
                pattern_id UUID NOT NULL,
                metadata JSONB,
                performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pattern_id) REFERENCES game_patterns(id)
            );
        `);
    }

    static async findSimilarTestPatterns(
        db: DatabaseAdapter<any>,
        embedding: number[],
        type: string,
        threshold: number = 0.85,
        limit: number = 5
    ): Promise<any[]> {
        const result = await db.query(
            `SELECT *,
                1 - (embedding <=> $1::vector) as similarity
            FROM game_patterns
            WHERE type = $2
                AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY similarity DESC
            LIMIT $4`,
            [embedding, type, threshold, limit]
        );
        return result.rows;
    }
}
