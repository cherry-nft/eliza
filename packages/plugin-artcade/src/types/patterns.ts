export interface GamePattern {
    id: string;
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
            game_mechanics?: Array<{
                type: string;
                properties: Record<string, any>;
            }>;
        };
    };
    embedding: number[];
    effectiveness_score: number;
    usage_count: number;
    created_at?: Date;
    last_used?: Date;
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
