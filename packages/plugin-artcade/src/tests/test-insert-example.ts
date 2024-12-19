import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface PatternData {
    pattern_name: string;
    embedding: number[];
    content: {
        context: string;
        html?: string;
        metadata?: Record<string, unknown>;
    };
    room_id: string;
    type: string;
    user_id: string;
    agent_id: string;
}

// Validation functions
function validateEmbedding(embedding: unknown): embedding is number[] {
    if (!Array.isArray(embedding)) {
        throw new Error("Embedding must be an array");
    }

    if (embedding.length !== 1536) {
        throw new Error(
            `Embedding must have exactly 1536 dimensions, got ${embedding.length}`
        );
    }

    if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
        throw new Error("All embedding values must be valid numbers");
    }

    if (!embedding.every((val) => val >= -1 && val <= 1)) {
        throw new Error("All embedding values must be between -1 and 1");
    }

    return true;
}

function validatePatternData(data: PatternData): void {
    if (!data.pattern_name || typeof data.pattern_name !== "string") {
        throw new Error("Pattern name is required and must be a string");
    }

    validateEmbedding(data.embedding);

    if (data.content.html && typeof data.content.html !== "string") {
        throw new Error("HTML content must be a string if provided");
    }

    if (data.content.context && typeof data.content.context !== "string") {
        throw new Error("Context must be a string if provided");
    }
}

async function insertPattern(patternData: PatternData): Promise<void> {
    try {
        // Validate the data
        validatePatternData(patternData);

        // Insert into database
        const { data, error } = await supabase
            .from("vector_patterns")
            .insert(patternData);

        if (error) {
            throw new Error(`Database insertion failed: ${error.message}`);
        }

        console.log("Pattern inserted successfully:", {
            pattern_name: patternData.pattern_name,
            embedding_length: patternData.embedding.length,
        });
    } catch (err) {
        console.error(
            "Error inserting pattern:",
            err instanceof Error ? err.message : String(err)
        );
        throw err;
    }
}

// Example usage
async function insertExamplePattern() {
    const examplePattern: PatternData = {
        pattern_name: "example_pattern",
        embedding: new Array(1536).fill(0.1),
        content: {
            context: "An example pattern",
            metadata: {
                source: "manual",
                version: "1.0",
            },
        },
        room_id: "example_room",
        type: "example_type",
        user_id: "example_user",
        agent_id: "example_agent",
    };

    await insertPattern(examplePattern);
}

// Use import.meta.url for ESM module detection
if (import.meta.url === `file://${process.argv[1]}`) {
    insertExamplePattern().catch(console.error);
}

// Export for use in other files
export {
    insertPattern,
    validateEmbedding,
    validatePatternData,
    type PatternData,
};
