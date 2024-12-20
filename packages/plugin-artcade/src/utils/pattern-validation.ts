import { GamePattern, PatternMetadata, SemanticTags } from "../types/patterns";

export function isValidPatternType(type: string): type is GamePattern["type"] {
    return [
        "animation",
        "layout",
        "interaction",
        "style",
        "game_mechanic",
    ].includes(type);
}

export function isValidSemanticTags(tags: any): tags is SemanticTags {
    if (!tags || typeof tags !== "object") return false;

    const requiredArrays = [
        "use_cases",
        "mechanics",
        "interactions",
        "visual_style",
    ];
    return requiredArrays.every(
        (key) =>
            Array.isArray(tags[key]) &&
            tags[key].every((item: any) => typeof item === "string")
    );
}

export function isValidPatternMetadata(
    metadata: any
): metadata is PatternMetadata {
    if (!metadata || typeof metadata !== "object") return false;

    // Optional string fields
    const optionalStringFields = [
        "description",
        "visual_type",
        "interaction_type",
        "animation_duration",
    ];
    const hasValidOptionalStrings = optionalStringFields.every(
        (field) => !metadata[field] || typeof metadata[field] === "string"
    );

    // Optional arrays
    const hasValidArrays =
        !metadata.color_scheme ||
        (Array.isArray(metadata.color_scheme) &&
            metadata.color_scheme.every(
                (color: any) => typeof color === "string"
            ));

    const hasValidDependencies =
        !metadata.dependencies ||
        (Array.isArray(metadata.dependencies) &&
            metadata.dependencies.every((dep: any) => typeof dep === "string"));

    // Game mechanics validation
    const hasValidGameMechanics =
        !metadata.game_mechanics ||
        (Array.isArray(metadata.game_mechanics) &&
            metadata.game_mechanics.every(
                (mech: any) =>
                    typeof mech === "object" &&
                    typeof mech.type === "string" &&
                    typeof mech.properties === "object"
            ));

    // Evolution validation
    const hasValidEvolution =
        !metadata.evolution ||
        (typeof metadata.evolution === "object" &&
            typeof metadata.evolution.parent_pattern_id === "string" &&
            Array.isArray(metadata.evolution.applied_patterns) &&
            metadata.evolution.applied_patterns.every(
                (pattern: any) => typeof pattern === "string"
            ) &&
            isValidPatternType(metadata.evolution.mutation_type) &&
            typeof metadata.evolution.fitness_scores === "object");

    // Semantic tags validation
    const hasValidSemanticTags =
        !metadata.semantic_tags || isValidSemanticTags(metadata.semantic_tags);

    return (
        hasValidOptionalStrings &&
        hasValidArrays &&
        hasValidDependencies &&
        hasValidGameMechanics &&
        hasValidEvolution &&
        hasValidSemanticTags
    );
}

export function isValidGamePattern(pattern: any): pattern is GamePattern {
    if (!pattern || typeof pattern !== "object") return false;

    // Required fields validation
    const hasRequiredFields =
        typeof pattern.id === "string" &&
        isValidPatternType(pattern.type) &&
        typeof pattern.pattern_name === "string" &&
        typeof pattern.content === "object" &&
        typeof pattern.content.html === "string" &&
        typeof pattern.content.context === "string" &&
        typeof pattern.effectiveness_score === "number" &&
        typeof pattern.usage_count === "number" &&
        typeof pattern.room_id === "string" &&
        typeof pattern.user_id === "string" &&
        typeof pattern.agent_id === "string";

    // Optional fields validation
    const hasValidOptionalFields =
        (!pattern.content.css || typeof pattern.content.css === "string") &&
        (!pattern.content.js || typeof pattern.content.js === "string") &&
        (!pattern.embedding || Array.isArray(pattern.embedding)) &&
        (!pattern.created_at || pattern.created_at instanceof Date) &&
        (!pattern.last_used || pattern.last_used instanceof Date);

    // Metadata validation
    const hasValidMetadata = isValidPatternMetadata(pattern.content.metadata);

    // Usage stats validation
    const hasValidUsageStats =
        !pattern.usage_stats ||
        (typeof pattern.usage_stats === "object" &&
            typeof pattern.usage_stats.total_uses === "number" &&
            typeof pattern.usage_stats.successful_uses === "number" &&
            typeof pattern.usage_stats.average_similarity === "number" &&
            pattern.usage_stats.last_used instanceof Date);

    // Claude usage metrics validation
    const hasValidClaudeMetrics =
        !pattern.claude_usage_metrics ||
        (typeof pattern.claude_usage_metrics === "object" &&
            typeof pattern.claude_usage_metrics.last_usage === "object" &&
            typeof pattern.claude_usage_metrics.last_usage.direct_reuse ===
                "boolean" &&
            typeof pattern.claude_usage_metrics.last_usage
                .structural_similarity === "number" &&
            Array.isArray(
                pattern.claude_usage_metrics.last_usage.feature_adoption
            ) &&
            pattern.claude_usage_metrics.last_usage.feature_adoption.every(
                (feature: any) => typeof feature === "string"
            ) &&
            pattern.claude_usage_metrics.last_usage.timestamp instanceof Date);

    return (
        hasRequiredFields &&
        hasValidOptionalFields &&
        hasValidMetadata &&
        hasValidUsageStats &&
        hasValidClaudeMetrics
    );
}

export function validateGamePattern(pattern: any): string[] {
    const errors: string[] = [];

    if (!pattern || typeof pattern !== "object") {
        errors.push("Pattern must be an object");
        return errors;
    }

    // Required fields
    if (!pattern.id) errors.push("Pattern ID is required");
    if (!pattern.type) errors.push("Pattern type is required");
    else if (!isValidPatternType(pattern.type))
        errors.push(`Invalid pattern type: ${pattern.type}`);
    if (!pattern.pattern_name) errors.push("Pattern name is required");
    if (!pattern.room_id) errors.push("Room ID is required");
    if (!pattern.user_id) errors.push("User ID is required");
    if (!pattern.agent_id) errors.push("Agent ID is required");

    // Content validation
    if (!pattern.content) {
        errors.push("Pattern content is required");
    } else {
        if (!pattern.content.html)
            errors.push("Pattern HTML content is required");
        if (!pattern.content.context)
            errors.push("Pattern context is required");
        if (!pattern.content.metadata)
            errors.push("Pattern metadata is required");
        else if (!isValidPatternMetadata(pattern.content.metadata)) {
            errors.push("Invalid pattern metadata structure");
        }
    }

    // Numeric fields
    if (typeof pattern.effectiveness_score !== "number")
        errors.push("Effectiveness score must be a number");
    if (typeof pattern.usage_count !== "number")
        errors.push("Usage count must be a number");

    // Usage stats validation
    if (pattern.usage_stats && typeof pattern.usage_stats === "object") {
        if (typeof pattern.usage_stats.total_uses !== "number")
            errors.push("Usage stats total_uses must be a number");
        if (typeof pattern.usage_stats.successful_uses !== "number")
            errors.push("Usage stats successful_uses must be a number");
        if (typeof pattern.usage_stats.average_similarity !== "number")
            errors.push("Usage stats average_similarity must be a number");
        if (!(pattern.usage_stats.last_used instanceof Date))
            errors.push("Usage stats last_used must be a Date");
    }

    // Claude metrics validation
    if (
        pattern.claude_usage_metrics &&
        typeof pattern.claude_usage_metrics === "object"
    ) {
        const lastUsage = pattern.claude_usage_metrics.last_usage;
        if (!lastUsage || typeof lastUsage !== "object") {
            errors.push("Claude usage metrics last_usage must be an object");
        } else {
            if (typeof lastUsage.direct_reuse !== "boolean")
                errors.push("Claude metrics direct_reuse must be a boolean");
            if (typeof lastUsage.structural_similarity !== "number")
                errors.push(
                    "Claude metrics structural_similarity must be a number"
                );
            if (!Array.isArray(lastUsage.feature_adoption))
                errors.push("Claude metrics feature_adoption must be an array");
            if (!(lastUsage.timestamp instanceof Date))
                errors.push("Claude metrics timestamp must be a Date");
        }
    }

    return errors;
}
