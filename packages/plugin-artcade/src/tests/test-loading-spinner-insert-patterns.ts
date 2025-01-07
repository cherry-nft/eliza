import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { promises as fs } from "fs";
import {
    validateEmbedding,
    validatePatternData,
    type PatternData,
} from "./test-insert-example";
import { loadingSpinnerPatterns } from "./test-loading-spinner-patterns";

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
    pattern: (typeof loadingSpinnerPatterns)[0]
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
        Functionality: Pure CSS animation, no JavaScript required
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertPattern(pattern: (typeof loadingSpinnerPatterns)[0]) {
    try {
        console.log(`Processing pattern: ${pattern.pattern_name}`);

        // Generate embedding
        const embedding = await generateEmbedding(pattern);

        // Validate embedding
        validateEmbedding(embedding);

        // Combine HTML, CSS, and JS into a single self-contained pattern
        // The pattern.content.html already contains the complete HTML structure
        const combinedHtml = pattern.content.html.replace(
            "</head>",
            `<style>${pattern.content.css}</style></head>`
        );

        // Prepare pattern data with embedding
        const patternData: PatternData = {
            pattern_name: pattern.pattern_name,
            embedding: embedding,
            content: {
                context: pattern.content.context,
                html: combinedHtml,
                metadata: pattern.content.metadata,
            },
            room_id: pattern.room_id,
            type: pattern.type,
            user_id: "loading-spinner-animation-1.html",
            agent_id: await fs.readFile(
                resolve(
                    __dirname,
                    "../../embeddings/templates/loading-spinner-animation-1.html"
                ),
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
    console.log("Starting Loading Spinner pattern insertions...");

    for (const pattern of loadingSpinnerPatterns) {
        await insertPattern(pattern);
    }

    console.log("Completed all pattern insertions!");
}

// Use import.meta.url for ESM module detection
if (import.meta.url === `file://${process.argv[1]}`) {
    insertAllPatterns().catch(console.error);
}

export { insertPattern, insertAllPatterns };
