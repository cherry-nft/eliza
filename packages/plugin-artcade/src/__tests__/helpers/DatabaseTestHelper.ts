import { DatabaseAdapter } from "@ai16z/eliza";
import { GamePattern } from "../../services/PatternStaging";

export class DatabaseTestHelper {
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
