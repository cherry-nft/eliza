/**
 * @description The source of truth for pattern types in the system. This interface defines the structure
 * that is used for database storage and retrieval. All pattern-related operations should use this type.
 *
 * Required fields for database ingestion:
 * - id: UUID string
 * - type: Must be one of the valid pattern types
 * - pattern_name: Unique identifier name
 * - content: Must contain at least html and context
 * - room_id: UUID string
 * - user_id: UUID string
 * - agent_id: UUID string
 *
 * The embedding field is automatically generated during storage operations.
 */
export interface GamePattern {
    id: string;
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: PatternMetadata;
    };
    embedding?: number[];
    effectiveness_score: number;
    usage_count: number;
    created_at?: Date;
    last_used?: Date;
    room_id: string;
    user_id: string;
    agent_id: string;
    usage_stats?: {
        total_uses: number;
        successful_uses: number;
        average_similarity: number;
        last_used: Date;
    };
    claude_usage_metrics?: {
        last_usage: {
            direct_reuse: boolean;
            structural_similarity: number;
            feature_adoption: string[];
            timestamp: Date;
        };
    };
}

export interface SemanticTags {
    use_cases: string[];
    mechanics: string[];
    interactions: string[];
    visual_style: string[];
}

export interface PatternMetadata {
    description?: string;
    visual_type?: string;
    interaction_type?: string;
    color_scheme?: string[];
    animation_duration?: string;
    dependencies?: string[];
    game_mechanics?: Array<{
        type: string;
        properties: Record<string, any>;
    }>;
    evolution?: {
        parent_pattern_id: string;
        applied_patterns: string[];
        mutation_type: GamePattern["type"];
        fitness_scores: Record<string, number>;
    };
    semantic_tags?: SemanticTags;
}

export interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string;
    location: {
        file: string;
        start_line: number;
        end_line: number;
    };
    pending_approval: boolean;
}

export interface ApprovalMetadata {
    reason: string;
    quality_notes?: string;
    inspiration_source?: string;
    approved_at: Date;
}

export interface PatternHistory {
    id: string;
    pattern_id: string;
    action: "created" | "approved" | "rejected" | "modified";
    timestamp: Date;
    metadata: {
        source_file?: string;
        line_range?: { start: number; end: number };
        approver?: string;
        reason?: string;
        changes?: string[];
    };
}
