import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { GamePattern } from "../../../src/types/patterns";
import { PatternEffectivenessMetrics } from "../../../src/types/effectiveness";
import { ClientPatternService } from "./ClientPatternService";

class PlaygroundPatternService extends Service {
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };
    private clientService: ClientPatternService;
    private patterns: Map<string, GamePattern>;

    constructor() {
        super();
        console.log("[PlaygroundPatternService] Initializing");
        this.patterns = new Map();
        this.clientService = new ClientPatternService();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        console.log(
            "[PlaygroundPatternService] Starting service initialization"
        );
        this.runtime = runtime;

        try {
            console.log("[PlaygroundPatternService] Loading initial patterns");
            const patterns = await this.clientService.getAllPatterns();
            console.log(
                "[PlaygroundPatternService] Retrieved patterns:",
                patterns
            );

            for (const pattern of patterns) {
                console.log(
                    "[PlaygroundPatternService] Processing pattern:",
                    pattern.id
                );
                this.patterns.set(pattern.id, pattern);
            }
            console.log(
                "[PlaygroundPatternService] Finished loading patterns. Total count:",
                this.patterns.size
            );
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Failed to load patterns:",
                error
            );
            throw error;
        }
    }

    async getPatterns(): Promise<GamePattern[]> {
        console.log("[PlaygroundPatternService] Getting all patterns");
        try {
            const patterns = await this.clientService.getAllPatterns();
            console.log(
                "[PlaygroundPatternService] Retrieved patterns:",
                patterns
            );
            return patterns;
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Error getting patterns:",
                error
            );
            throw error;
        }
    }

    async generateFromPrompt(prompt: string) {
        console.log(
            "[PlaygroundPatternService] Generating pattern from prompt:",
            prompt
        );
        try {
            const response = await this.clientService.generatePattern(prompt);
            console.log(
                "[PlaygroundPatternService] Generated pattern:",
                response
            );
            return response;
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Error generating pattern:",
                error
            );
            throw error;
        }
    }

    async searchSimilarPatterns(
        pattern: GamePattern,
        limit: number = 5
    ): Promise<GamePattern[]> {
        console.log(
            "[PlaygroundPatternService] Searching similar patterns for:",
            pattern
        );
        console.log("[PlaygroundPatternService] Search limit:", limit);

        try {
            const similarPatterns =
                await this.clientService.findSimilarPatterns(pattern, limit);
            console.log(
                "[PlaygroundPatternService] Found similar patterns:",
                similarPatterns
            );
            return similarPatterns;
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Error searching similar patterns:",
                error
            );
            throw error;
        }
    }

    async comparePatterns(
        generatedHtml: string,
        pattern: GamePattern
    ): Promise<PatternEffectivenessMetrics> {
        console.log("[PlaygroundPatternService] Comparing patterns");
        console.log(
            "[PlaygroundPatternService] Generated HTML length:",
            generatedHtml.length
        );
        console.log("[PlaygroundPatternService] Pattern:", pattern);

        try {
            const feedback = await this.clientService.comparePatterns(
                generatedHtml,
                pattern
            );
            console.log(
                "[PlaygroundPatternService] Comparison feedback:",
                feedback
            );

            // Convert feedback to metrics format
            return {
                pattern_id: pattern.id,
                prompt_keywords: [],
                embedding_similarity: feedback.embedding_similarity || 0,
                claude_usage: {
                    direct_reuse: false,
                    structural_similarity: feedback.structural_similarity || 0,
                    feature_adoption: [],
                    timestamp: new Date(),
                },
                quality_scores: {
                    visual: feedback.visualAppeal?.colorHarmony || 0,
                    interactive: feedback.interactivity?.responsiveness || 0,
                    functional: feedback.gameplayElements?.playerControls || 0,
                    performance: feedback.performance?.smoothness || 0,
                },
                usage_stats: {
                    total_uses: 1,
                    successful_uses: 1,
                    average_similarity: feedback.average_similarity || 0,
                    last_used: new Date(),
                },
            };
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Error comparing patterns:",
                error
            );
            throw error;
        }
    }

    async evolvePattern(
        pattern: GamePattern,
        config: {
            mutationRate?: number;
            populationSize?: number;
            preservedSections?: {
                code: string;
                type: "physics" | "ui" | "logic";
            }[];
        } = {}
    ): Promise<GamePattern> {
        console.log("[PlaygroundPatternService] Evolving pattern:", pattern);
        console.log("[PlaygroundPatternService] Evolution config:", config);

        try {
            const evolvedPattern = await this.clientService.evolvePattern(
                pattern,
                config
            );
            console.log(
                "[PlaygroundPatternService] Evolution complete:",
                evolvedPattern
            );

            // Store the evolved pattern
            await this.clientService.storePattern(evolvedPattern);
            console.log("[PlaygroundPatternService] Stored evolved pattern");

            return evolvedPattern;
        } catch (error) {
            console.error(
                "[PlaygroundPatternService] Error evolving pattern:",
                error
            );
            throw error;
        }
    }
}

export const patternService = new PlaygroundPatternService();
