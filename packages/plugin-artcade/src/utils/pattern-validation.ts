import { GamePattern, PatternMetadata } from "../types/patterns";

const validPatternTypes = [
    "animation",
    "layout",
    "interaction",
    "style",
    "game_mechanic",
] as const;

export class PatternValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PatternValidationError";
    }
}

export function validatePatternType(
    type: string
): type is (typeof validPatternTypes)[number] {
    return validPatternTypes.includes(
        type as (typeof validPatternTypes)[number]
    );
}

export function validateEmbedding(embedding?: number[]): void {
    if (embedding) {
        if (!Array.isArray(embedding)) {
            throw new PatternValidationError("Embedding must be an array");
        }
        if (embedding.length !== 1536) {
            throw new PatternValidationError(
                `Embedding must have exactly 1536 dimensions, got ${embedding.length}`
            );
        }
        if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
            throw new PatternValidationError(
                "All embedding values must be valid numbers"
            );
        }
        if (!embedding.every((val) => val >= -1 && val <= 1)) {
            throw new PatternValidationError(
                "All embedding values must be between -1 and 1"
            );
        }
    }
}

export function validateMetadata(metadata: PatternMetadata): void {
    if (metadata.semantic_tags) {
        const { use_cases, mechanics, interactions, visual_style } =
            metadata.semantic_tags;
        if (
            !Array.isArray(use_cases) ||
            !Array.isArray(mechanics) ||
            !Array.isArray(interactions) ||
            !Array.isArray(visual_style)
        ) {
            throw new PatternValidationError(
                "Semantic tags must contain arrays for use_cases, mechanics, interactions, and visual_style"
            );
        }
    }
}

export function validateGamePattern(pattern: GamePattern): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!pattern.id) errors.push("Pattern ID is required");
    if (!pattern.pattern_name) errors.push("Pattern name is required");
    if (!pattern.room_id) errors.push("Room ID is required");
    if (!pattern.user_id) errors.push("User ID is required");
    if (!pattern.agent_id) errors.push("Agent ID is required");

    // Validate pattern type
    if (!validatePatternType(pattern.type)) {
        errors.push(
            `Invalid pattern type: ${pattern.type}. Must be one of: ${validPatternTypes.join(", ")}`
        );
    }

    // Validate content
    if (!pattern.content) {
        errors.push("Content is required");
    } else {
        if (!pattern.content.html) errors.push("HTML content is required");
        if (!pattern.content.context) errors.push("Context is required");

        // Validate metadata if present
        if (pattern.content.metadata) {
            try {
                validateMetadata(pattern.content.metadata);
            } catch (error) {
                if (error instanceof PatternValidationError) {
                    errors.push(error.message);
                }
            }
        }
    }

    // Validate embedding if present
    if (pattern.embedding) {
        try {
            validateEmbedding(pattern.embedding);
        } catch (error) {
            if (error instanceof PatternValidationError) {
                errors.push(error.message);
            }
        }
    }

    // Validate numeric fields
    if (
        typeof pattern.effectiveness_score !== "number" ||
        pattern.effectiveness_score < 0
    ) {
        errors.push("Effectiveness score must be a non-negative number");
    }
    if (typeof pattern.usage_count !== "number" || pattern.usage_count < 0) {
        errors.push("Usage count must be a non-negative number");
    }

    return errors;
}

export function assertValidPattern(pattern: GamePattern): void {
    const errors = validateGamePattern(pattern);
    if (errors.length > 0) {
        throw new PatternValidationError(
            `Invalid pattern: ${errors.join(", ")}`
        );
    }
}
