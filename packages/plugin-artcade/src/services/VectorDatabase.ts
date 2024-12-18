import {
    Service,
    IAgentRuntime,
    elizaLogger,
    DatabaseAdapter,
    MemoryManager,
    Memory,
    Content,
    UUID,
    IMemoryManager,
} from "@ai16z/eliza";
import { GamePattern } from "../types/patterns";
import {
    PatternEffectivenessMetrics,
    ClaudeUsageContext,
    PatternFeatures,
    QualityScores,
} from "../types/effectiveness";
import { parse } from "node-html-parser";

// Custom error class for database operations
class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = "DatabaseError";
        if (cause) {
            this.cause = cause;
        }
    }
}

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
    private embeddingCache!: any;
    private vectorOps!: any;
    private memoryManager!: MemoryManager;
    private cache: Map<
        string,
        {
            pattern: GamePattern;
            timestamp: number;
        }
    > = new Map();
    private readonly CACHE_TTL = 300000; // 5 minutes
    private readonly EMBEDDING_DIMENSION = 1536;
    private readonly TABLE_NAME = "game_patterns";

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
        this.db = runtime.databaseAdapter;

        // Initialize Eliza's core components
        this.embeddingCache = runtime.embeddingCache;
        this.vectorOps = runtime.vectorOperations;

        // Get memory manager with proper type checking
        const memoryManager = runtime.getMemoryManager?.();
        if (!memoryManager) {
            throw new Error("Memory manager is required but not available");
        }
        this.memoryManager = memoryManager;

        // Initialize database schema and security
        await this.initializeSchema();
        await this.setupSecurity();
        await this.setupAuditLogging();
        await this.setupVectorOperations();
        await this.memoryManager.initialize?.();
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
                    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_audit_logs_pattern ON pattern_audit_logs(pattern_id);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON pattern_audit_logs(operation);
            `);
        } catch (error) {
            this.runtime.logger.error("Failed to setup audit logging", {
                error,
            });
            throw new DatabaseError("Failed to setup audit logging", error);
        }
    }

    private async setupVectorOperations(): Promise<void> {
        try {
            await this.vectorOps.initialize({
                tableName: this.TABLE_NAME,
                embeddingColumn: "embedding",
                dimension: this.EMBEDDING_DIMENSION,
                distanceMetric: "cosine",
                indexType: "hnsw", // Explicitly use HNSW as recommended
            });

            this.runtime.logger.info(
                "Vector operations initialized with HNSW index"
            );
        } catch (error) {
            this.runtime.logger.error(
                "Failed to initialize vector operations",
                { error }
            );
            throw new DatabaseError(
                "Vector operations initialization failed",
                error
            );
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
            throw new DatabaseError("Failed to log operation", error);
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
            try {
                // Get patterns to be deleted
                const patternsToDelete = await client.query(
                    `SELECT id FROM ${this.TABLE_NAME}
                     WHERE last_used < $1
                     AND usage_count = 0`,
                    [cutoffDate]
                );

                // Log deletions
                for (const pattern of patternsToDelete.rows) {
                    await this.logOperation({
                        operation: "CLEANUP_DELETE",
                        pattern_id: pattern.id,
                        metadata: { cutoff_days: cutoffDays },
                        performed_at: new Date(),
                    });

                    // Clear pattern from cache
                    await this.embeddingCache.delete(`pattern_${pattern.id}`);
                }

                // Perform deletion
                await client.query(
                    `DELETE FROM ${this.TABLE_NAME}
                     WHERE last_used < $1
                     AND usage_count = 0`,
                    [cutoffDate]
                );

                this.runtime.logger.info("Completed pattern cleanup", {
                    deletedCount: patternsToDelete.rows.length,
                    cutoffDays,
                });
            } catch (error) {
                this.runtime.logger.error("Failed to cleanup old patterns", {
                    error,
                    cutoffDays,
                });
                throw new DatabaseError("Pattern cleanup failed", error);
            }
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
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    type TEXT NOT NULL,
                    pattern_name TEXT NOT NULL,
                    content JSONB NOT NULL,
                    embedding VECTOR(${this.EMBEDDING_DIMENSION}),
                    effectiveness_score FLOAT DEFAULT 0,
                    usage_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    last_used TIMESTAMPTZ,
                    claude_usage_metrics JSONB DEFAULT '{}'::jsonb
                );
            `);

            this.runtime.logger.info(
                "Database schema initialized successfully"
            );
        } catch (error) {
            this.runtime.logger.error("Failed to initialize database schema", {
                error,
            });
            throw new DatabaseError("Schema initialization failed", error);
        }
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        if (
            !pattern.embedding ||
            pattern.embedding.length !== this.EMBEDDING_DIMENSION
        ) {
            throw new DatabaseError(
                `Invalid embedding dimension: ${pattern.embedding?.length}`
            );
        }

        try {
            // Convert GamePattern to Memory format
            const memory: Memory = {
                id: pattern.id as UUID,
                content: {
                    text: JSON.stringify({
                        type: pattern.type,
                        pattern_name: pattern.pattern_name,
                        data: pattern.content,
                        effectiveness_score: pattern.effectiveness_score,
                        usage_count: pattern.usage_count,
                    }),
                    attachments: [],
                },
                embedding: pattern.embedding,
                tableName: this.TABLE_NAME,
                userId: "system" as UUID,
                roomId: "patterns" as UUID,
                agentId: "artcade" as UUID,
                createdAt: Date.now(),
            };

            // Store using MemoryManager
            await this.memoryManager.createMemory(memory);

            // Clear caches
            const cacheKey = `pattern_${pattern.id}`;
            await this.embeddingCache.delete(cacheKey);
            this.cache.delete(pattern.id);

            // Log operation
            await this.logOperation({
                operation: "STORE_PATTERN",
                pattern_id: pattern.id,
                metadata: { type: pattern.type },
                performed_at: new Date(),
            });
        } catch (error) {
            this.runtime.logger.error("Failed to store pattern", {
                error,
                patternId: pattern.id,
            });
            throw new DatabaseError("Store with features failed", error);
        }
    }

    private handleDatabaseError(error: any): Error {
        if (error instanceof DatabaseError) {
            return error;
        }
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
        return new DatabaseError("Database operation failed", error);
    }

    async findSimilarPatterns(
        embedding: number[],
        type: string,
        threshold: number = 0.85,
        limit: number = 5
    ): Promise<VectorSearchResult[]> {
        try {
            // Validate embedding dimension
            if (embedding.length !== this.EMBEDDING_DIMENSION) {
                throw new DatabaseError(
                    `Invalid embedding dimension: ${embedding.length}`
                );
            }

            // Try to get from cache first
            const cacheKey = `${type}_${embedding.join(",")}`;
            const cachedResults = await this.embeddingCache.get(cacheKey);
            if (cachedResults && cachedResults.length > 0) {
                return cachedResults.map((result: any) => ({
                    pattern: result.pattern,
                    similarity: result.similarity || 0,
                }));
            }

            // Use memory manager's search capabilities
            const memories = await this.memoryManager.searchMemoriesByEmbedding(
                embedding,
                {
                    match_threshold: threshold,
                    count: limit,
                    tableName: this.TABLE_NAME,
                    filter: { type },
                }
            );

            const patterns = memories.map((memory) => {
                const content = JSON.parse(memory.content.text);
                return {
                    pattern: {
                        id: memory.id,
                        type: content.type,
                        pattern_name: content.pattern_name,
                        content: content.data,
                        embedding: memory.embedding,
                        effectiveness_score: content.effectiveness_score,
                        usage_count: content.usage_count,
                    },
                    similarity: memory.similarity || 0,
                };
            });

            // Cache the results
            await this.embeddingCache.set(cacheKey, patterns, this.CACHE_TTL);

            return patterns;
        } catch (error) {
            this.runtime.logger.error("Failed to find similar patterns", {
                error,
                type,
                threshold,
            });
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError("Vector operation failed", error);
        }
    }

    async updateEffectivenessScore(id: string, score: number): Promise<void> {
        try {
            const memory = await this.memoryManager.getMemory(
                id as UUID,
                this.TABLE_NAME
            );
            if (!memory) {
                throw new DatabaseError("Pattern not found");
            }

            const content = JSON.parse(memory.content.text);
            content.effectiveness_score = score;

            await this.memoryManager.updateMemory({
                ...memory,
                content: {
                    ...memory.content,
                    text: JSON.stringify(content),
                },
            });

            this.runtime.logger.debug(
                `Updated effectiveness score for pattern ${id}`,
                { score }
            );
        } catch (error) {
            this.runtime.logger.error(
                `Failed to update effectiveness score for pattern ${id}`,
                { error }
            );
            throw new DatabaseError(
                "Failed to update effectiveness score",
                error
            );
        }
    }

    async incrementUsageCount(id: string): Promise<void> {
        try {
            const memory = await this.memoryManager.getMemory(
                id as UUID,
                this.TABLE_NAME
            );
            if (!memory) {
                throw new DatabaseError("Pattern not found");
            }

            const content = JSON.parse(memory.content.text);
            content.usage_count = (content.usage_count || 0) + 1;

            await this.memoryManager.updateMemory({
                ...memory,
                content: {
                    ...memory.content,
                    text: JSON.stringify(content),
                },
            });

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
            throw new DatabaseError("Failed to increment usage count", error);
        }
    }

    async getPatternById(id: string): Promise<GamePattern | null> {
        // Check cache first
        const cachedPattern = this.getCachedPattern(id);
        if (cachedPattern) {
            return cachedPattern;
        }

        try {
            // Use memory manager to get the pattern
            const memory = await this.memoryManager.getMemory(
                id as UUID,
                this.TABLE_NAME
            );
            if (!memory) {
                return null;
            }

            const content = JSON.parse(memory.content.text);
            const pattern: GamePattern = {
                id: memory.id,
                type: content.type,
                pattern_name: content.pattern_name,
                content: content.data,
                embedding: memory.embedding,
                effectiveness_score: content.effectiveness_score,
                usage_count: content.usage_count,
            };

            // Cache the result
            this.setCachedPattern(pattern);

            return pattern;
        } catch (error) {
            this.runtime.logger.error(`Failed to get pattern by id ${id}`, {
                error,
            });
            throw new DatabaseError("Failed to get pattern by ID", error);
        }
    }

    async listStoredPatterns(): Promise<GamePattern[]> {
        try {
            const memories = await this.memoryManager.getMemories({
                tableName: this.TABLE_NAME,
                count: 10,
                unique: true,
            });

            return memories.map((memory) => {
                const content = JSON.parse(memory.content.text);
                return {
                    id: memory.id,
                    type: content.type,
                    pattern_name: content.pattern_name,
                    content: content.data,
                    embedding: memory.embedding,
                    effectiveness_score: content.effectiveness_score,
                    usage_count: content.usage_count,
                };
            });
        } catch (error) {
            this.runtime.logger.error("Failed to list stored patterns", {
                error,
            });
            throw new DatabaseError("Failed to list patterns", error);
        }
    }

    async getPatternByName(patternName: string): Promise<GamePattern | null> {
        try {
            const memories = await this.memoryManager.getMemories({
                tableName: this.TABLE_NAME,
                filter: { pattern_name: patternName },
                count: 1,
            });

            if (memories.length === 0) {
                return null;
            }

            const memory = memories[0];
            const content = JSON.parse(memory.content.text);
            return {
                id: memory.id,
                type: content.type,
                pattern_name: content.pattern_name,
                content: content.data,
                embedding: memory.embedding,
                effectiveness_score: content.effectiveness_score,
                usage_count: content.usage_count,
            };
        } catch (error) {
            this.runtime.logger.error("Failed to get pattern by name", {
                error,
                patternName,
            });
            throw new DatabaseError("Failed to get pattern by name", error);
        }
    }

    async trackClaudeUsage(context: ClaudeUsageContext): Promise<void> {
        const { prompt, generated_html, matched_patterns, quality_assessment } =
            context;

        for (const match of matched_patterns) {
            const { pattern_id, similarity, features_used } = match;

            // Get existing pattern
            const memory = await this.memoryManager.getMemory(
                pattern_id as UUID,
                this.TABLE_NAME
            );
            if (!memory) {
                this.runtime.logger.warn(`Pattern ${pattern_id} not found`);
                continue;
            }

            const content = JSON.parse(memory.content.text);
            const currentStats = content.usage_stats || {
                total_uses: 0,
                successful_uses: 0,
                average_similarity: 0,
                last_used: new Date(),
            };

            // Update usage stats
            const newStats = {
                total_uses: currentStats.total_uses + 1,
                successful_uses:
                    currentStats.successful_uses + (similarity > 0.8 ? 1 : 0),
                average_similarity:
                    (currentStats.average_similarity * currentStats.total_uses +
                        similarity) /
                    (currentStats.total_uses + 1),
                last_used: new Date(),
            };

            // Calculate new effectiveness score
            const newScore =
                this.calculateEffectivenessScore(quality_assessment);

            // Update pattern memory
            await this.memoryManager.updateMemory({
                ...memory,
                content: {
                    text: JSON.stringify({
                        ...content,
                        effectiveness_score: newScore,
                        usage_stats: newStats,
                        claude_usage_metrics: {
                            ...(content.claude_usage_metrics || {}),
                            last_usage: {
                                direct_reuse: similarity > 0.9,
                                structural_similarity: similarity,
                                feature_adoption: features_used,
                                timestamp: new Date(),
                            },
                        },
                    }),
                    attachments: [],
                },
            });

            // Log the operation
            await this.logOperation({
                operation: "CLAUDE_USAGE",
                pattern_id,
                metadata: {
                    similarity,
                    features_used,
                    prompt_keywords: this.extractKeywords(prompt),
                    quality_scores: quality_assessment,
                },
                performed_at: new Date(),
            });
        }
    }

    private calculateEffectivenessScore(
        scores: PatternEffectivenessMetrics["quality_scores"]
    ): number {
        const weights = {
            visual: 0.25,
            interactive: 0.25,
            functional: 0.25,
            performance: 0.25,
        };

        return Object.entries(scores).reduce(
            (score, [key, value]) =>
                score + value * weights[key as keyof typeof weights],
            0
        );
    }

    private extractKeywords(prompt: string): string[] {
        // Split on whitespace and special characters, convert to lowercase
        const words = prompt
            .toLowerCase()
            .split(/[\s,.!?;:()\[\]{}'"]+/)
            .filter(
                (word) =>
                    // Filter out common words and ensure minimum length
                    word.length >= 3 &&
                    ![
                        "the",
                        "and",
                        "with",
                        "for",
                        "from",
                        "that",
                        "this",
                        "have",
                        "will",
                    ].includes(word)
            );

        // Get unique words and take top 10
        return [...new Set(words)].slice(0, 10);
    }

    private extractPatternFeatures(html: string): PatternFeatures {
        // Natural language: Extract key features from HTML content to create a fingerprint
        const root = parse(html);

        return {
            visual: {
                hasAnimations:
                    html.includes("@keyframes") || html.includes("animation"),
                colorCount: (html.match(/#[0-9a-f]{3,6}|rgb|rgba|hsl/gi) || [])
                    .length,
                layoutType: this.detectLayoutType(html),
            },
            interactive: {
                eventListeners: this.extractEventListeners(html),
                hasUserInput:
                    html.includes("input") ||
                    html.includes("button") ||
                    html.includes("form"),
                stateChanges:
                    html.includes("useState") ||
                    html.includes("setState") ||
                    html.includes("classList.toggle"),
            },
            functional: {
                hasGameLogic: this.detectGameLogic(html),
                dataManagement:
                    html.includes("data-") || html.includes("useState"),
                complexity: this.calculateComplexity(html),
            },
        };
    }

    private detectLayoutType(html: string): "flex" | "grid" | "standard" {
        if (html.includes("display: grid") || html.includes("grid-template"))
            return "grid";
        if (html.includes("display: flex")) return "flex";
        return "standard";
    }

    private extractEventListeners(html: string): string[] {
        const events = html.match(/on[A-Z][a-zA-Z]+=|addEventListener/g) || [];
        return events.map((e) =>
            e.replace("on", "").replace("=", "").toLowerCase()
        );
    }

    private detectGameLogic(html: string): boolean {
        const gamePatterns = [
            "score",
            "health",
            "level",
            "game",
            "player",
            "collision",
            "requestAnimationFrame",
            "gameLoop",
            "update",
        ];
        return gamePatterns.some((pattern) => html.includes(pattern));
    }

    private calculateComplexity(html: string): number {
        const root = parse(html);
        const depth = this.calculateDOMDepth(root);
        const elements = root.querySelectorAll("*").length;
        const scripts = (html.match(/<script/g) || []).length;

        // Normalize to 0-1 range
        return Math.min(depth * 0.2 + elements * 0.01 + scripts * 0.1, 1);
    }

    private calculateDOMDepth(node: any, depth: number = 0): number {
        if (!node.childNodes || node.childNodes.length === 0) return depth;
        return Math.max(
            ...node.childNodes.map((child) =>
                this.calculateDOMDepth(child, depth + 1)
            )
        );
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            if (!this.runtime?.vectorOperations) {
                throw new DatabaseError("Vector operations not initialized");
            }
            return await this.runtime.vectorOperations.generateEmbedding(text);
        } catch (error) {
            throw new DatabaseError("Failed to generate embedding", error);
        }
    }
}
