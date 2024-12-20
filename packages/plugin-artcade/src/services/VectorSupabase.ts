import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GamePattern } from "../types/patterns";
import { parse, HTMLElement as ParsedHTMLElement } from "node-html-parser";
import {
    PatternEffectivenessMetrics,
    ClaudeUsageContext,
    PatternFeatures,
} from "../types/effectiveness";
import {
    assertValidPattern,
    PatternValidationError,
} from "../utils/pattern-validation";

// Pattern type validation
const validPatternTypes = [
    "animation",
    "layout",
    "interaction",
    "style",
    "game_mechanic",
] as const;
type ValidPatternType = (typeof validPatternTypes)[number];

function isValidPatternType(type: string): type is ValidPatternType {
    return validPatternTypes.includes(type as ValidPatternType);
}

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

    constructor(supabaseUrl: string) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase service role key");
        }

        this.supabase = createClient(
            supabaseUrl,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                db: {
                    schema: "public",
                },
                global: {
                    headers: {
                        "x-my-custom-header": "my-app-name",
                    },
                },
            }
        );

        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Missing OpenAI API key");
        }

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    private async generateEmbedding(pattern: GamePattern): Promise<number[]> {
        const textToEmbed = `
            Pattern: ${pattern.pattern_name || "Untitled"}
            Type: ${pattern.type || "unknown"}
            Description: ${pattern.content?.context || pattern.content?.metadata?.description || "No description"}
            Keywords: ${pattern.room_id ? pattern.room_id.replace(/-/g, " ").replace(/_/g, " ") : ""}
            Content: ${pattern.content?.html || ""} ${pattern.content?.css || ""} ${pattern.content?.js || ""}
        `.trim();

        return this.generateEmbeddingFromText(textToEmbed);
    }

    public async generateEmbeddingFromText(text: string): Promise<number[]> {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: [text],
            encoding_format: "float",
        });

        return response.data[0].embedding;
    }

    private async generateEmbeddingFromPattern(
        pattern: GamePattern
    ): Promise<number[]> {
        return this.generateEmbedding(pattern);
    }

    private async generatePromptEmbedding(prompt: string): Promise<number[]> {
        const keywords = this.extractKeywords(prompt);
        const formattedPrompt = `
            Pattern: ${prompt}
            Type: search
            Description: ${prompt}
            Keywords: ${keywords.join(" ")}
            Content: ${prompt}
        `.trim();

        console.log(
            "[VectorSupabase] Formatted prompt for embedding:",
            formattedPrompt
        );

        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: [formattedPrompt],
            encoding_format: "float",
        });

        return response.data[0].embedding;
    }

    async storePromptEmbedding(options: {
        prompt: string;
        userId: string;
        sessionId?: string;
        projectContext?: string;
    }): Promise<void> {
        try {
            const startTime = Date.now();
            const embedding = await this.generatePromptEmbedding(
                options.prompt
            );

            const promptData = {
                user_id: options.userId,
                prompt: options.prompt,
                embedding,
                session_id: options.sessionId,
                project_context: options.projectContext,
                response_time_ms: Date.now() - startTime,
            };

            const { error } = await this.supabase
                .from("prompt_embeddings")
                .insert(promptData);

            if (error) throw error;
        } catch (error) {
            console.error("Failed to store prompt embedding:", error);
            throw new DatabaseError("Failed to store prompt embedding", error);
        }
    }

    async updatePromptMatchResults(
        promptId: string,
        options: {
            matchedPatternIds: string[];
            selectedPatternId?: string;
            successScore?: number;
            userFeedback?: string;
        }
    ): Promise<void> {
        try {
            const updateData: Record<string, any> = {
                matched_pattern_ids: options.matchedPatternIds,
            };

            if (options.selectedPatternId) {
                updateData.selected_pattern_id = options.selectedPatternId;
            }

            if (options.successScore !== undefined) {
                updateData.success_score = options.successScore;
            }

            if (options.userFeedback) {
                updateData.user_feedback = options.userFeedback;
            }

            const { error } = await this.supabase
                .from("prompt_embeddings")
                .update(updateData)
                .eq("id", promptId);

            if (error) throw error;
        } catch (error) {
            console.error("Failed to update prompt results:", error);
            throw new DatabaseError("Failed to update prompt results", error);
        }
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        try {
            // Validate the pattern using our utility
            assertValidPattern(pattern);

            const embedding = await this.generateEmbedding(pattern);

            const patternToStore = {
                ...pattern,
                embedding,
                effectiveness_score: pattern.effectiveness_score || 0,
                usage_count: pattern.usage_count || 0,
                created_at: pattern.created_at || new Date(),
                last_used: pattern.last_used || new Date(),
            };

            const { error } = await this.supabase
                .from("vector_patterns")
                .insert(patternToStore);

            if (error) throw error;
        } catch (error) {
            console.error("Failed to store pattern:", error);
            if (error instanceof PatternValidationError) {
                throw error;
            }
            throw new DatabaseError(
                "Failed to store pattern",
                error instanceof Error ? error.message : error
            );
        }
    }

    async findSimilarPatterns(
        input: string | GamePattern,
        threshold = 0.3,
        limit = 5,
        type?: GamePattern["type"]
    ): Promise<Array<{ pattern: GamePattern; similarity: number }>> {
        try {
            let searchEmbedding: number[];
            let searchText: string;

            if (typeof input === "string") {
                console.log(
                    "[VectorSupabase] Generating embedding from text input:",
                    input
                );
                searchEmbedding = await this.generatePromptEmbedding(input);
                searchText = input;
            } else {
                console.log(
                    "[VectorSupabase] Generating embedding from pattern:",
                    input.pattern_name
                );
                searchEmbedding = await this.generateEmbedding(input);
                searchText =
                    `${input.pattern_name} ${input.type} ${input.content?.context || ""} ${input.content?.metadata?.description || ""}`.trim();
            }

            console.log("[VectorSupabase] Search parameters:", {
                threshold,
                limit,
                type,
                embeddingSize: searchEmbedding.length,
                searchText,
                keywords: this.extractKeywords(searchText),
            });

            const { data, error } = await this.supabase.rpc("match_patterns", {
                query_embedding: searchEmbedding,
                query_text: searchText,
                match_threshold: threshold,
                match_count: type ? limit * 2 : limit,
            });

            if (error) {
                console.error("[VectorSupabase] Database search error:", error);
                throw error;
            }

            // Log all similarity scores for analysis
            console.log("\n[VectorSupabase] Pattern search results:");
            if (data && data.length > 0) {
                for (const result of data) {
                    console.log(
                        `\nPattern: "${result.pattern_name}" (${result.type})`
                    );
                    console.log(
                        `Total Score: ${result.similarity.toFixed(4)} ${
                            result.similarity >= threshold ? "✓" : "✗"
                        }`
                    );
                    // Include room_id from the result directly since it's in the SQL response
                    if (result.room_id) {
                        const tags = result.room_id.split("-");
                        console.log("Semantic Tags:");
                        console.log(
                            "- Use Cases:",
                            tags[0]?.replace(/_/g, " ")
                        );
                        console.log(
                            "- Mechanics:",
                            tags[1]?.replace(/_/g, " ")
                        );
                        console.log(
                            "- Interactions:",
                            tags[2]?.replace(/_/g, " ")
                        );
                        console.log(
                            "- Visual Style:",
                            tags[3]?.replace(/_/g, " ")
                        );
                    }
                }
            } else {
                console.log("No patterns found in search");
            }

            // Return the filtered results
            return data.map((result: any) => ({
                pattern: {
                    id: result.id,
                    pattern_name: result.pattern_name,
                    type: result.type,
                    content: result.content,
                    effectiveness_score: result.effectiveness_score,
                    room_id: result.room_id,
                },
                similarity: result.similarity,
            }));
        } catch (error) {
            console.error(
                "[VectorSupabase] Error in findSimilarPatterns:",
                error
            );
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
        const { matched_patterns, quality_assessment } = context;

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
        scores: ClaudeUsageContext["quality_assessment"]
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

    private calculateDOMDepth(
        node: ParsedHTMLElement,
        depth: number = 0
    ): number {
        if (!node.childNodes || node.childNodes.length === 0) return depth;
        return Math.max(
            ...Array.from(node.childNodes).map((child) =>
                this.calculateDOMDepth(child as ParsedHTMLElement, depth + 1)
            )
        );
    }

    async getPattern(id: string): Promise<GamePattern | null> {
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
            return null;
        }
    }
}
