import { GamePattern } from "../../../src/types/patterns";
import { PatternEffectivenessMetrics } from "../../../src/types/effectiveness";

class PlaygroundPatternService {
    private patterns: Map<string, GamePattern>;

    constructor() {
        this.patterns = new Map();
    }

    async initialize() {
        try {
            const patternsData = await import(
                "../../../src/data/patterns.json"
            );
            const patterns = Array.isArray(patternsData.default)
                ? patternsData.default
                : patternsData;
            patterns.forEach((pattern: any) => {
                // Add a mock embedding for visualization
                const mockPattern: GamePattern = {
                    ...pattern,
                    embedding: [Math.random(), Math.random()], // Mock 2D embedding for visualization
                };
                this.patterns.set(pattern.id, mockPattern);
            });
        } catch (error) {
            console.error("Failed to load patterns:", error);
            throw error;
        }
    }

    async getPatterns(): Promise<GamePattern[]> {
        return Array.from(this.patterns.values());
    }

    async searchSimilarPatterns(
        pattern: GamePattern,
        limit: number = 5
    ): Promise<GamePattern[]> {
        // Simple mock implementation that returns random patterns
        const allPatterns = Array.from(this.patterns.values());
        return allPatterns.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    async getPatternMetrics(
        patternId: string
    ): Promise<PatternEffectivenessMetrics | null> {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return null;

        return {
            pattern_id: pattern.id,
            prompt_keywords: [],
            embedding_similarity: Math.random(),
            claude_usage: {
                direct_reuse: false,
                structural_similarity: Math.random(),
                feature_adoption: [],
                timestamp: new Date(),
            },
            quality_scores: {
                visual: pattern.effectiveness_score || Math.random(),
                interactive: pattern.effectiveness_score || Math.random(),
                functional: pattern.effectiveness_score || Math.random(),
                performance: pattern.effectiveness_score || Math.random(),
            },
            usage_stats: {
                total_uses: pattern.usage_count || 0,
                successful_uses: pattern.usage_count || 0,
                average_similarity: Math.random(),
                last_used: new Date(),
            },
        };
    }
}

export const patternService = new PlaygroundPatternService();
