import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
    const enhancedText = `
        Query: ${text}
        Core Concepts: ${
            text.toLowerCase().includes("racing")
                ? "vehicle movement, physics-based controls, smooth acceleration, drift mechanics"
                : ""
        }
        ${text.toLowerCase().includes("controls") ? "precise movement, physics simulation, momentum-based mechanics" : ""}
        ${text.toLowerCase().includes("game") ? "interactive experience, player feedback, game mechanics" : ""}
        Essential Features:
        - Smooth, physics-based movement
        - Precise control mechanics
        - Dynamic camera tracking
        - Visual feedback systems
        Original Query: ${text}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: enhancedText,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function searchPatterns(query: string) {
    console.log(`\nSearching for: "${query}"\n`);

    try {
        // Generate embedding for the search query
        const embedding = await generateEmbedding(query);

        // Search for matching patterns
        const { data: matches, error } = await supabase.rpc("match_patterns", {
            query_embedding: embedding,
            match_threshold: 0.4,
            match_count: 3,
        });

        if (error) {
            console.error("Error searching patterns:", error);
            return;
        }

        // Display results
        if (matches && matches.length > 0) {
            matches.forEach((match, i) => {
                console.log(
                    `\nMatch ${i + 1} (${(match.similarity * 100).toFixed(2)}% similar):`
                );
                console.log(`- Pattern: ${match.pattern_name}`);
                console.log(`- Type: ${match.type}`);
                console.log(
                    `- Effectiveness Score: ${match.effectiveness_score}`
                );
                console.log(`- Description: ${match.content.context}`);
            });
        } else {
            console.log("No matches found above the similarity threshold.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// Test a variety of queries
const queries = [
    "I need a car racing game with smooth controls",
    "Add some cool explosion effects to my game",
    "I want police chase mechanics in my game",
    "Need a good UI for different game modes",
    "Add some sound effects for my game",
];

console.log("Starting pattern search tests...");
(async () => {
    for (const query of queries) {
        await searchPatterns(query);
    }
})();
