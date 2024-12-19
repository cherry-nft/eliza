import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || ""
);

const movementPattern = {
    id: uuidv4(),
    room_id: uuidv4(),
    user_id: uuidv4(),
    agent_id: uuidv4(),
    type: "movement",
    pattern_name: "Geometry Rush Movement System",
    content: {
        description:
            "A smooth, responsive movement system with acceleration and deceleration, designed specifically for fast-paced geometric avoidance gameplay. The system provides precise control while maintaining momentum, creating a challenging but fair experience.",
        features: [
            "Smooth acceleration",
            "Responsive controls",
            "Momentum-based movement",
            "Direction changes",
            "Speed ramping",
            "Predictable physics",
            "Tight turning radius",
            "Variable speed control",
            "Instant response to input",
            "Momentum preservation",
        ],
        code_snippet: `
// Movement logic with smooth acceleration
let velocity = { x: 0, y: 0 };
const acceleration = 0.5;
const maxSpeed = 5;
const friction = 0.95;
const turnSpeed = 0.15;
const minSpeed = 0.1;

function updateMovement() {
    // Apply acceleration based on input
    if (keys.right) velocity.x = Math.min(velocity.x + acceleration, maxSpeed);
    if (keys.left) velocity.x = Math.max(velocity.x - acceleration, -maxSpeed);

    // Apply friction
    velocity.x *= friction;

    // Ensure minimum speed for better control
    if (Math.abs(velocity.x) < minSpeed) velocity.x = 0;

    // Apply turning mechanics
    if (velocity.x !== 0) {
        player.rotation += velocity.x * turnSpeed;
    }

    // Update position with momentum
    player.x += velocity.x;
}`,
        implementation_notes: [
            "Uses velocity-based movement for smooth transitions",
            "Implements acceleration for natural feel",
            "Includes friction for better control",
            "Caps maximum speed for balanced gameplay",
            "Maintains momentum for skill-based gameplay",
            "Implements turn radius based on speed",
            "Uses minimal speed threshold to prevent drift",
            "Balances responsiveness with physics simulation",
            "Optimized for 60fps gameplay",
            "Designed for keyboard and touch input",
        ],
        effectiveness_metrics: {
            responsiveness: 0.95,
            smoothness: 0.9,
            player_satisfaction: 0.85,
            learning_curve: 0.75,
            skill_ceiling: 0.9,
            physics_accuracy: 0.85,
            input_latency: 0.95,
            control_precision: 0.9,
        },
        gameplay_impact: {
            difficulty_contribution: 0.8,
            skill_expression: 0.9,
            fun_factor: 0.85,
            replayability: 0.9,
        },
        technical_details: {
            frame_rate_target: 60,
            input_buffer_size: 3,
            physics_timestep: 1 / 60,
            collision_precision: 0.95,
        },
    },
    effectiveness_score: 0.9,
    usage_count: 1,
};

async function generateEmbedding(pattern: typeof movementPattern) {
    // Combine all relevant text for embedding
    const textToEmbed = `
        Pattern: ${pattern.pattern_name}
        Type: ${pattern.type}
        Description: ${pattern.content.description}
        Features: ${pattern.content.features.join(", ")}
        Implementation Notes: ${pattern.content.implementation_notes.join(", ")}
        Code Context: ${pattern.content.code_snippet}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertMovementPattern() {
    try {
        // Generate real embedding
        const embedding = await generateEmbedding(movementPattern);

        // Insert pattern with real embedding
        const { data, error } = await supabase
            .from("vector_patterns")
            .insert({
                ...movementPattern,
                embedding,
            })
            .select();

        if (error) throw error;
        console.log("Insert successful:", data);
    } catch (error) {
        console.error("Failed to insert pattern:", error);
    }
}

async function searchSimilarPatterns(searchText: string) {
    try {
        // Generate embedding for search text
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: searchText,
            encoding_format: "float",
        });
        const searchEmbedding = response.data[0].embedding;

        // Query using vector similarity
        const { data, error } = await supabase.rpc("match_patterns", {
            query_embedding: searchEmbedding,
            match_threshold: 0.5,
            match_count: 5,
        });

        if (error) throw error;
        console.log("Search results:", data);
    } catch (error) {
        console.error("Search failed:", error);
    }
}

// Test search
searchSimilarPatterns("movement system with smooth acceleration and momentum");

insertMovementPattern();
