import { GamePattern } from "./patterns";

export interface PatternEffectivenessMetrics {
    pattern_id: string;
    prompt_keywords: string[];
    embedding_similarity: number;
    claude_usage: {
        direct_reuse: boolean;
        structural_similarity: number;
        feature_adoption: string[];
        timestamp: Date;
    };
    quality_scores: {
        visual: number;
        interactive: number;
        functional: number;
        performance: number;
    };
    usage_stats: {
        total_uses: number;
        successful_uses: number;
        average_similarity: number;
        last_used: Date;
    };
}

export interface ClaudeUsageContext {
    prompt: string;
    generated_html: string;
    similarity_score: number;
    matched_patterns: Array<{
        pattern_id: string;
        similarity: number;
        features_used: string[];
    }>;
    quality_assessment: {
        visual_score: number;
        interactive_score: number;
        functional_score: number;
        performance_score: number;
    };
}

export interface EffectivenessReport {
    pattern_id: string;
    usage_statistics: {
        total_uses: number;
        successful_uses: number;
        quality_improvement_rate: number;
    };
    keyword_correlations: Map<string, number>;
    quality_trends: {
        visual_trend: number[];
        interactive_trend: number[];
        functional_trend: number[];
    };
    gaps_identified: string[];
}
