import { GamePattern, SemanticTags } from "../types/patterns";

/**
 * Extracts semantic tags from a pattern based on its content and metadata
 */
export function extractSemanticTags(pattern: GamePattern): SemanticTags {
    // Initialize empty tags object
    const tags: SemanticTags = {
        use_cases: [],
        mechanics: [],
        interactions: [],
        visual_style: [],
    };

    // First priority: Use explicitly defined semantic tags if they exist
    if (pattern.content.metadata.semantic_tags) {
        const explicitTags = pattern.content.metadata.semantic_tags;
        tags.use_cases.push(...explicitTags.use_cases);
        tags.mechanics.push(...explicitTags.mechanics);
        tags.interactions.push(...explicitTags.interactions);
        tags.visual_style.push(...explicitTags.visual_style);
    }

    // If any category is empty, fall back to inference logic
    if (
        tags.use_cases.length === 0 ||
        tags.mechanics.length === 0 ||
        tags.interactions.length === 0 ||
        tags.visual_style.length === 0
    ) {
        // Extract from pattern name and type
        const name = pattern.pattern_name.toLowerCase();
        const type = pattern.type;

        // Game mechanics extraction
        if (type === "game_mechanic") {
            if (tags.mechanics.length === 0) {
                tags.mechanics.push("game_mechanic");
                if (name.includes("movement")) tags.mechanics.push("movement");
                if (name.includes("physics")) tags.mechanics.push("physics");
                if (name.includes("collision"))
                    tags.mechanics.push("collision");
            }
        }

        // Extract from content context
        const context = pattern.content.context.toLowerCase();
        if (tags.use_cases.length === 0) {
            if (context.includes("racing")) tags.use_cases.push("racing_game");
            if (context.includes("driving"))
                tags.use_cases.push("driving_simulation");
        }
        if (tags.mechanics.length === 0 && context.includes("vehicle")) {
            tags.mechanics.push("vehicle_control");
        }

        // Extract from metadata
        const metadata = pattern.content.metadata;
        if (tags.interactions.length === 0 && metadata.interaction_type) {
            tags.interactions.push(metadata.interaction_type);
        }
        if (tags.visual_style.length === 0 && metadata.visual_type) {
            tags.visual_style.push(metadata.visual_type);
        }
        if (tags.mechanics.length === 0 && metadata.game_mechanics) {
            metadata.game_mechanics.forEach((mech) => {
                tags.mechanics.push(mech.type);
            });
        }

        // Analyze code content for additional hints
        if (pattern.content.js) {
            const js = pattern.content.js.toLowerCase();
            if (tags.interactions.length === 0) {
                if (js.includes("keydown") || js.includes("keyup")) {
                    tags.interactions.push("keyboard_control");
                }
                if (js.includes("mousemove") || js.includes("click")) {
                    tags.interactions.push("mouse_control");
                }
            }
            if (tags.visual_style.length === 0 && js.includes("animation")) {
                tags.visual_style.push("animated");
            }
        }
    }

    // Deduplicate tags
    return {
        use_cases: [...new Set(tags.use_cases)],
        mechanics: [...new Set(tags.mechanics)],
        interactions: [...new Set(tags.interactions)],
        visual_style: [...new Set(tags.visual_style)],
    };
}

/**
 * Encodes semantic tags into a room_id format
 */
export function encodeSemanticRoomId(tags: SemanticTags): string {
    // Create segments that fit UUID format (8-4-4-4-12)
    const segments = [
        (tags.use_cases.join("_") || "00000000").slice(0, 8),
        (tags.mechanics.join("_") || "0000").slice(0, 4),
        (tags.interactions.join("_") || "0000").slice(0, 4),
        (tags.visual_style.join("_") || "0000").slice(0, 4),
        "000000000000", // Padding to maintain UUID length
    ];

    return segments.join("-");
}

/**
 * Decodes a room_id back into semantic tags
 */
export function parseSemanticRoomId(roomId: string): SemanticTags {
    const [uses, mechs, inters, visuals] = roomId.split("-");

    return {
        use_cases: uses === "00000000" ? [] : uses.split("_"),
        mechanics: mechs === "0000" ? [] : mechs.split("_"),
        interactions: inters === "0000" ? [] : inters.split("_"),
        visual_style: visuals === "0000" ? [] : visuals.split("_"),
    };
}

/**
 * Calculates semantic similarity boost based on matching tags
 */
export function calculateSemanticBoost(
    patternTags: SemanticTags,
    queryTags: SemanticTags
): number {
    let boost = 0;

    // Weight different tag types
    const weights = {
        use_cases: 0.4,
        mechanics: 0.3,
        interactions: 0.2,
        visual_style: 0.1,
    };

    // Calculate intersection sizes
    const intersections = {
        use_cases: patternTags.use_cases.filter((tag) =>
            queryTags.use_cases.includes(tag)
        ).length,
        mechanics: patternTags.mechanics.filter((tag) =>
            queryTags.mechanics.includes(tag)
        ).length,
        interactions: patternTags.interactions.filter((tag) =>
            queryTags.interactions.includes(tag)
        ).length,
        visual_style: patternTags.visual_style.filter((tag) =>
            queryTags.visual_style.includes(tag)
        ).length,
    };

    // Calculate weighted boost
    Object.entries(weights).forEach(([key, weight]) => {
        const matchCount = intersections[key as keyof typeof intersections];
        if (matchCount > 0) {
            boost +=
                weight *
                (matchCount / patternTags[key as keyof SemanticTags].length);
        }
    });

    return boost;
}
