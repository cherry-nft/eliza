import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GamePattern } from "../types/patterns";
import { parse } from "node-html-parser";
import {
    PatternEffectivenessMetrics,
    ClaudeUsageContext,
    PatternFeatures,
} from "../types/effectiveness";

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

export class VectorSupabase {
    private supabase;
    private openai;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private readonly EMBEDDING_DIMENSION = 1536;

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL ||
                "https://drhgdchrqzidfmhgekva.supabase.co",
            process.env.SUPABASE_KEY || ""
        );

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    private async generateEmbedding(pattern: GamePattern): Promise<number[]> {
        const textToEmbed = `
            Pattern: ${pattern.pattern_name}
            Type: ${pattern.type}
            Description: ${pattern.content.context}
            HTML: ${pattern.content.html}
            ${pattern.content.css ? `CSS: ${pattern.content.css}` : ""}
            ${pattern.content.js ? `JS: ${pattern.content.js}` : ""}
            Metadata: ${JSON.stringify(pattern.content.metadata)}
        `.trim();

        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: textToEmbed,
            encoding_format: "float",
        });

        return response.data[0].embedding;
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        try {
            const embedding = await this.generateEmbedding(pattern);

            const { error } = await this.supabase
                .from("vector_patterns")
                .insert({
                    ...pattern,
                    embedding,
                });

            if (error) throw error;
        } catch (error) {
            console.error("Failed to store pattern:", error);
            throw error;
        }
    }

    async findSimilarPatterns(
        searchText: string,
        threshold = 0.5,
        limit = 5
    ): Promise<GamePattern[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: searchText,
                encoding_format: "float",
            });
            const searchEmbedding = response.data[0].embedding;

            const { data, error } = await this.supabase.rpc("match_patterns", {
                query_embedding: searchEmbedding,
                match_threshold: threshold,
                match_count: limit,
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to find similar patterns:", error);
            throw error;
        }
    }

    async getAllPatterns(): Promise<GamePattern[]> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("*");

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to get patterns:", error);
            throw error;
        }
    }

    async getPatternById(id: string): Promise<GamePattern> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to get pattern:", error);
            throw error;
        }
    }

    async updatePatternUsageCount(id: string): Promise<void> {
        try {
            const { error } = await this.supabase.rpc(
                "increment_pattern_usage",
                {
                    pattern_id: id,
                }
            );

            if (error) throw error;
        } catch (error) {
            console.error("Failed to update pattern usage count:", error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("count");
            return !error;
        } catch (error) {
            console.error("Database health check failed", { error });
            return false;
        }
    }

    async cleanupOldPatterns(cutoffDays: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

        try {
            const { error } = await this.supabase
                .from("vector_patterns")
                .delete()
                .lt("last_used", cutoffDate.toISOString())
                .eq("usage_count", 0);

            if (error) throw error;
        } catch (error) {
            console.error("Failed to cleanup old patterns", {
                error,
                cutoffDays,
            });
            throw new DatabaseError("Pattern cleanup failed", error);
        }
    }

    async trackClaudeUsage(context: ClaudeUsageContext): Promise<void> {
        const { prompt, generated_html, matched_patterns, quality_assessment } =
            context;

        for (const match of matched_patterns) {
            const { pattern_id, similarity, features_used } = match;

            try {
                // Get existing pattern
                const { data: pattern, error } = await this.supabase
                    .from("vector_patterns")
                    .select("*")
                    .eq("id", pattern_id)
                    .single();

                if (error || !pattern) {
                    console.warn(`Pattern ${pattern_id} not found`);
                    continue;
                }

                const currentStats = pattern.usage_stats || {
                    total_uses: 0,
                    successful_uses: 0,
                    average_similarity: 0,
                    last_used: new Date(),
                };

                // Update usage stats
                const newStats = {
                    total_uses: currentStats.total_uses + 1,
                    successful_uses:
                        currentStats.successful_uses +
                        (similarity > 0.8 ? 1 : 0),
                    average_similarity:
                        (currentStats.average_similarity *
                            currentStats.total_uses +
                            similarity) /
                        (currentStats.total_uses + 1),
                    last_used: new Date(),
                };

                // Calculate new effectiveness score
                const newScore =
                    this.calculateEffectivenessScore(quality_assessment);

                // Update pattern
                const { error: updateError } = await this.supabase
                    .from("vector_patterns")
                    .update({
                        effectiveness_score: newScore,
                        usage_stats: newStats,
                        claude_usage_metrics: {
                            ...(pattern.claude_usage_metrics || {}),
                            last_usage: {
                                direct_reuse: similarity > 0.9,
                                structural_similarity: similarity,
                                feature_adoption: features_used,
                                timestamp: new Date(),
                            },
                        },
                    })
                    .eq("id", pattern_id);

                if (updateError) throw updateError;
            } catch (error) {
                console.error("Failed to track Claude usage", {
                    error,
                    pattern_id,
                });
                throw new DatabaseError("Failed to track Claude usage", error);
            }
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
}
