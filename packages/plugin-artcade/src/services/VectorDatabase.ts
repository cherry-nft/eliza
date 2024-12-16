import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { Pool, PoolConfig } from "pg";
import { GamePattern } from "./PatternStaging";

export interface VectorSearchResult {
    pattern: GamePattern;
    similarity: number;
}

export class VectorDatabase extends Service {
    private pool: Pool;
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;

        // Get database configuration from runtime
        const config: PoolConfig = {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            // Additional config from runtime if needed
        };

        this.pool = new Pool(config);

        // Initialize database schema
        await this.initializeSchema();
    }

    private async initializeSchema(): Promise<void> {
        try {
            // Enable vector extension if not exists
            await this.pool.query(`
                CREATE EXTENSION IF NOT EXISTS vector;
                CREATE EXTENSION IF NOT EXISTS hnsw;
            `);

            // Create pattern similarity function
            await this.pool.query(`
                CREATE OR REPLACE FUNCTION pattern_similarity(
                    pattern1 vector,
                    pattern2 vector
                ) RETURNS float AS $$
                    SELECT 1 - (pattern1 <=> pattern2);
                $$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;
            `);

            // Create patterns table with vector support
            await this.pool.query(`
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
            const {
                id,
                type,
                pattern_name,
                content,
                embedding,
                effectiveness_score,
                usage_count,
            } = pattern;

            await this.pool.query(
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

            this.runtime.logger.debug(`Stored pattern: ${pattern_name}`, {
                id,
                type,
            });
        } catch (error) {
            this.runtime.logger.error(
                `Failed to store pattern: ${pattern.pattern_name}`,
                { error }
            );
            throw error;
        }
    }

    async findSimilarPatterns(
        embedding: number[],
        type: string,
        threshold: number = 0.85,
        limit: number = 5
    ): Promise<VectorSearchResult[]> {
        try {
            const result = await this.pool.query(
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
            await this.pool.query(
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
            await this.pool.query(
                `
                UPDATE game_patterns
                SET
                    usage_count = usage_count + 1,
                    last_used = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [id]
            );

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
        try {
            const result = await this.pool.query(
                "SELECT * FROM game_patterns WHERE id = $1",
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                type: row.type,
                pattern_name: row.pattern_name,
                content: row.content,
                embedding: row.embedding,
                effectiveness_score: row.effectiveness_score,
                usage_count: row.usage_count,
            };
        } catch (error) {
            this.runtime.logger.error(`Failed to get pattern ${id}`, { error });
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        await this.pool.end();
    }
}
