import {
    Service,
    IAgentRuntime,
    elizaLogger,
    DatabaseAdapter,
    DatabaseError,
    TransactionClient,
} from "@ai16z/eliza";
import { GamePattern } from "./PatternStaging";

export interface VectorSearchResult {
    pattern: GamePattern;
    similarity: number;
}

interface AuditLogEntry {
    operation: string;
    pattern_id: string;
    metadata: Record<string, any>;
    performed_at: Date;
}

export class VectorDatabase extends Service {
    private db!: DatabaseAdapter<any>;
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };
    private cache: Map<
        string,
        {
            pattern: GamePattern;
            timestamp: number;
        }
    > = new Map();
    private readonly CACHE_TTL = 300000; // 5 minutes

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
        this.db = runtime.getDatabaseAdapter();

        // Initialize database schema and security
        await this.initializeSchema();
        await this.setupSecurity();
        await this.setupAuditLogging();
    }

    private async setupSecurity(): Promise<void> {
        try {
            await this.db.query(`
                ALTER TABLE game_patterns ENABLE ROW LEVEL SECURITY;

                CREATE POLICY "patterns_isolation" ON game_patterns
                    USING (auth.uid() = "userId" OR auth.uid() = "agentId");
            `);
        } catch (error) {
            this.runtime.logger.warn("Failed to setup RLS, may already exist", {
                error,
            });
        }
    }

    private async setupAuditLogging(): Promise<void> {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS pattern_audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    operation TEXT NOT NULL,
                    pattern_id UUID NOT NULL,
                    metadata JSONB,
                    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (pattern_id) REFERENCES game_patterns(id)
                );

                CREATE INDEX IF NOT EXISTS idx_audit_logs_pattern
                ON pattern_audit_logs(pattern_id);

                CREATE INDEX IF NOT EXISTS idx_audit_logs_operation
                ON pattern_audit_logs(operation);
            `);
        } catch (error) {
            this.runtime.logger.error("Failed to setup audit logging", {
                error,
            });
            throw error;
        }
    }

    private async logOperation(entry: AuditLogEntry): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO pattern_audit_logs (
                    operation,
                    pattern_id,
                    metadata,
                    performed_at
                ) VALUES ($1, $2, $3, $4)`,
                [
                    entry.operation,
                    entry.pattern_id,
                    entry.metadata,
                    entry.performed_at,
                ]
            );
        } catch (error) {
            this.runtime.logger.error("Failed to log operation", {
                error,
                entry,
            });
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.db.query("SELECT 1");
            return true;
        } catch (error) {
            this.runtime.logger.error("Database health check failed", {
                error,
            });
            return false;
        }
    }

    async cleanupOldPatterns(cutoffDays: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

        await this.db.transaction(async (client) => {
            // Get patterns to be deleted for audit
            const patternsToDelete = await client.query(
                `SELECT id FROM game_patterns
                 WHERE last_used < $1
                 AND usage_count = 0`,
                [cutoffDate]
            );

            // Log deletion in audit
            for (const pattern of patternsToDelete.rows) {
                await this.logOperation({
                    operation: "CLEANUP_DELETE",
                    pattern_id: pattern.id,
                    metadata: { cutoff_days: cutoffDays },
                    performed_at: new Date(),
                });
            }

            // Perform deletion
            await client.query(
                `DELETE FROM game_patterns
                 WHERE last_used < $1
                 AND usage_count = 0`,
                [cutoffDate]
            );
        });
    }

    private getCachedPattern(id: string): GamePattern | null {
        const cached = this.cache.get(id);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(id);
            return null;
        }

        return cached.pattern;
    }

    private setCachedPattern(pattern: GamePattern): void {
        this.cache.set(pattern.id, {
            pattern,
            timestamp: Date.now(),
        });
    }

    private async initializeSchema(): Promise<void> {
        try {
            // Enable vector extension if not exists
            await this.db.query(`
                CREATE EXTENSION IF NOT EXISTS vector;
                CREATE EXTENSION IF NOT EXISTS hnsw;
            `);

            // Create pattern similarity function
            await this.db.query(`
                CREATE OR REPLACE FUNCTION pattern_similarity(
                    pattern1 vector,
                    pattern2 vector
                ) RETURNS float AS $$
                    SELECT 1 - (pattern1 <=> pattern2);
                $$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;
            `);

            // Create patterns table with vector support
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS game_patterns (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    type TEXT NOT NULL,
                    pattern_name TEXT NOT NULL,
                    content JSONB NOT NULL,
                    embedding vector(1536),
                    effectiveness_score FLOAT DEFAULT 0,
                    usage_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    last_used TIMESTAMPTZ,
                    approval_metadata JSONB
                );

                CREATE INDEX IF NOT EXISTS idx_game_patterns_embedding
                ON game_patterns USING hnsw (embedding vector_cosine_ops);
            `);

            this.runtime.logger.info("Vector database schema initialized");
        } catch (error) {
            this.runtime.logger.error(
                "Failed to initialize vector database schema",
                { error }
            );
            throw error;
        }
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        try {
            await this.db.transaction(async (client) => {
                const {
                    id,
                    type,
                    pattern_name,
                    content,
                    embedding,
                    effectiveness_score,
                    usage_count,
                } = pattern;

                await client.query(
                    `
                    INSERT INTO game_patterns (
                        id,
                        type,
                        pattern_name,
                        content,
                        embedding,
                        effectiveness_score,
                        usage_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type,
                        pattern_name = EXCLUDED.pattern_name,
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        effectiveness_score = EXCLUDED.effectiveness_score,
                        usage_count = EXCLUDED.usage_count,
                        last_used = CURRENT_TIMESTAMP
                    `,
                    [
                        id,
                        type,
                        pattern_name,
                        content,
                        embedding,
                        effectiveness_score,
                        usage_count,
                    ]
                );

                await this.logOperation({
                    operation: "STORE_PATTERN",
                    pattern_id: id,
                    metadata: { type, pattern_name },
                    performed_at: new Date(),
                });

                // Update cache
                this.setCachedPattern(pattern);
            });

            this.runtime.logger.debug(
                `Stored pattern: ${pattern.pattern_name}`,
                {
                    id: pattern.id,
                    type: pattern.type,
                }
            );
        } catch (error) {
            this.runtime.logger.error(
                `Failed to store pattern: ${pattern.pattern_name}`,
                { error }
            );
            throw this.handleDatabaseError(error);
        }
    }

    private handleDatabaseError(error: any): Error {
        if (error.code === "23505") {
            // Unique violation
            return new DatabaseError(
                "Pattern with this ID already exists",
                error
            );
        }
        if (error.code === "23503") {
            // Foreign key violation
            return new DatabaseError(
                "Referenced pattern does not exist",
                error
            );
        }
        return error;
    }

    async findSimilarPatterns(
        embedding: number[],
        type: string,
        threshold: number = 0.85,
        limit: number = 5
    ): Promise<VectorSearchResult[]> {
        try {
            const result = await this.db.query(
                `
                SELECT *,
                    pattern_similarity(embedding, $1::vector) as similarity
                FROM game_patterns
                WHERE
                    type = $2 AND
                    pattern_similarity(embedding, $1::vector) > $3
                ORDER BY similarity DESC
                LIMIT $4;
                `,
                [embedding, type, threshold, limit]
            );

            return result.rows.map((row) => ({
                pattern: {
                    id: row.id,
                    type: row.type,
                    pattern_name: row.pattern_name,
                    content: row.content,
                    embedding: row.embedding,
                    effectiveness_score: row.effectiveness_score,
                    usage_count: row.usage_count,
                },
                similarity: row.similarity,
            }));
        } catch (error) {
            this.runtime.logger.error("Failed to find similar patterns", {
                error,
            });
            throw error;
        }
    }

    async updateEffectivenessScore(id: string, score: number): Promise<void> {
        try {
            await this.db.query(
                `
                UPDATE game_patterns
                SET
                    effectiveness_score = $2,
                    last_used = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [id, score]
            );

            this.runtime.logger.debug(
                `Updated effectiveness score for pattern ${id}`,
                { score }
            );
        } catch (error) {
            this.runtime.logger.error(
                `Failed to update effectiveness score for pattern ${id}`,
                { error }
            );
            throw error;
        }
    }

    async incrementUsageCount(id: string): Promise<void> {
        try {
            await this.db.query(
                `
                UPDATE game_patterns
                SET
                    usage_count = usage_count + 1,
                    last_used = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [id]
            );

            await this.logOperation({
                operation: "INCREMENT_USAGE",
                pattern_id: id,
                metadata: { timestamp: new Date() },
                performed_at: new Date(),
            });

            this.runtime.logger.debug(
                `Incremented usage count for pattern ${id}`
            );
        } catch (error) {
            this.runtime.logger.error(
                `Failed to increment usage count for pattern ${id}`,
                { error }
            );
            throw error;
        }
    }

    async getPatternById(id: string): Promise<GamePattern | null> {
        // Check cache first
        const cachedPattern = this.getCachedPattern(id);
        if (cachedPattern) {
            return cachedPattern;
        }

        try {
            const result = await this.db.query(
                "SELECT * FROM game_patterns WHERE id = $1",
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            const pattern = {
                id: row.id,
                type: row.type,
                pattern_name: row.pattern_name,
                content: row.content,
                embedding: row.embedding,
                effectiveness_score: row.effectiveness_score,
                usage_count: row.usage_count,
            };

            // Cache the result
            this.setCachedPattern(pattern);

            return pattern;
        } catch (error) {
            this.runtime.logger.error(`Failed to get pattern by id ${id}`, {
                error,
            });
            throw error;
        }
    }
}
