import { DatabaseAdapter } from "@ai16z/eliza";
import { GamePattern } from "../../services/PatternStaging";

export class DatabaseTestHelper {
    static async setupTestDatabase(db: DatabaseAdapter<any>): Promise<void> {
        // Drop existing tables
        await db.query("DROP TABLE IF EXISTS pattern_audit_logs CASCADE");
        await db.query("DROP TABLE IF EXISTS game_patterns CASCADE");

        // Create extensions
        await db.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE EXTENSION IF NOT EXISTS hnsw;
        `);

        // Create pattern similarity function
        await db.query(`
            CREATE OR REPLACE FUNCTION pattern_similarity(
                pattern1 vector,
                pattern2 vector
            ) RETURNS float AS $$
                SELECT 1 - (pattern1 <=> pattern2);
            $$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;
        `);

        // Create tables
        await db.query(`
            CREATE TABLE game_patterns (
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

            CREATE INDEX idx_game_patterns_embedding
            ON game_patterns USING hnsw (embedding vector_cosine_ops);

            CREATE TABLE pattern_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                operation TEXT NOT NULL,
                pattern_id UUID NOT NULL,
                metadata JSONB,
                performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pattern_id) REFERENCES game_patterns(id)
            );

            CREATE INDEX idx_audit_logs_pattern ON pattern_audit_logs(pattern_id);
            CREATE INDEX idx_audit_logs_operation ON pattern_audit_logs(operation);
        `);
    }

    static async createTestPattern(
        db: DatabaseAdapter<any>,
        pattern: Partial<GamePattern> = {}
    ): Promise<GamePattern> {
        const testPattern: GamePattern = {
            id: crypto.randomUUID(),
            type: "animation",
            pattern_name: "test_pattern",
            content: {
                html: "<div>Test</div>",
                css: ".test { color: red; }",
                context: "test",
                metadata: {
                    visual_type: "test",
                },
            },
            embedding: Array(1536).fill(0.1),
            effectiveness_score: 1.0,
            usage_count: 0,
            ...pattern,
        };

        await db.query(
            `INSERT INTO game_patterns (
                id, type, pattern_name, content, embedding,
                effectiveness_score, usage_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                testPattern.id,
                testPattern.type,
                testPattern.pattern_name,
                testPattern.content,
                testPattern.embedding,
                testPattern.effectiveness_score,
                testPattern.usage_count,
            ]
        );

        return testPattern;
    }

    static async getAuditLogs(
        db: DatabaseAdapter<any>,
        patternId: string
    ): Promise<any[]> {
        const result = await db.query(
            "SELECT * FROM pattern_audit_logs WHERE pattern_id = $1 ORDER BY performed_at DESC",
            [patternId]
        );
        return result.rows;
    }

    static async cleanup(db: DatabaseAdapter<any>): Promise<void> {
        await db.query("DROP TABLE IF EXISTS pattern_audit_logs CASCADE");
        await db.query("DROP TABLE IF EXISTS game_patterns CASCADE");
    }
}
