import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { promises as fs } from "fs";
import { validateEmbedding, validatePatternData } from "./test-insert-example";
import { gravitySimulatorPatterns } from "./test-gravity-simulator-patterns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(
    pattern: (typeof gravitySimulatorPatterns)[0]
): Promise<number[]> {
    // Create a rich text description for embedding
    const textToEmbed = `
        Pattern Name: ${pattern.pattern_name}
        Type: ${pattern.type}
        Description: ${pattern.content.context}
        Features: ${JSON.stringify(pattern.content.metadata)}
        Semantic Tags: ${pattern.room_id}
        ${pattern.content.html ? `HTML Structure: ${pattern.content.html}` : ""}
        ${pattern.content.css ? `Styling: ${pattern.content.css}` : ""}
        ${pattern.content.js ? `Functionality: ${pattern.content.js}` : ""}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertPattern(pattern: (typeof gravitySimulatorPatterns)[0]) {
    try {
        console.log(`Processing pattern: ${pattern.pattern_name}`);

        // Generate embedding
        const embedding = await generateEmbedding(pattern);

        // Validate embedding
        validateEmbedding(embedding);

        // Combine HTML, CSS, and JS into a single self-contained pattern
        const combinedHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        ${pattern.content.css || ""}
    </style>
</head>
<body>
    ${pattern.content.html || ""}
    <script>
        ${pattern.content.js || ""}
    </script>
</body>
</html>`.trim();

        // Prepare pattern data with embedding
        const patternData = {
            pattern_name: pattern.pattern_name,
            embedding: embedding,
            content: {
                context: pattern.content.context,
                html: combinedHtml,
                metadata: pattern.content.metadata,
            },
            room_id: pattern.room_id,
            type: pattern.type,
            user_id: "gravity-simulator.html",
            agent_id: await fs.readFile(
                resolve(__dirname, "../../embeddings/gravity-simulator.html"),
                "utf-8"
            ),
        };

        // Validate complete pattern data
        validatePatternData(patternData);

        // Insert into database
        const { error } = await supabase
            .from("vector_patterns")
            .insert(patternData);

        if (error) {
            throw new Error(
                `Database insertion failed for ${pattern.pattern_name}: ${error.message}`
            );
        }

        console.log(`Successfully inserted pattern: ${pattern.pattern_name}`);
    } catch (err) {
        console.error(
            `Failed to insert pattern ${pattern.pattern_name}:`,
            err instanceof Error ? err.message : String(err)
        );
        throw err;
    }
}

async function insertAllPatterns() {
    console.log("Starting Gravity Simulator pattern insertions...");

    for (const pattern of gravitySimulatorPatterns) {
        await insertPattern(pattern);
    }

    console.log("Completed all pattern insertions!");
}

// Use import.meta.url for ESM module detection
if (import.meta.url === `file://${process.argv[1]}`) {
    insertAllPatterns().catch(console.error);
}

export { insertPattern, insertAllPatterns };
