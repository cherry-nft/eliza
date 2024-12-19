import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function testSimilarity() {
    console.log("Starting similarity test...\n");

    // First, let's check what functions are available
    console.log("Checking available functions...");
    const { data: functions, error: functionError } = await supabase.rpc(
        "get_available_functions"
    );
    console.log("Available functions:", functions || "None found");
    if (functionError) console.error("Function error:", functionError);

    // Test query for racing game mechanics
    const testQuery = `
        Advanced racing game with the following features:
        - Smooth vehicle movement
        - Physics-based controls
        - Drift mechanics
        - Speed trails
        - Camera tracking
    `.trim();

    console.log("\nTest query:", testQuery);
    console.log("\nGenerating embedding for test query...");

    const queryEmbedding = await generateEmbedding(testQuery);
    console.log("\nEmbedding vector length:", queryEmbedding.length);
    console.log("First few values:", queryEmbedding.slice(0, 5));

    // Try a direct cosine similarity query first
    console.log("\nTrying direct vector similarity query...");
    const { data: directMatches, error: directError } = await supabase
        .from("vector_patterns")
        .select("*")
        .limit(1);

    if (directError) {
        console.error("Direct query error:", directError);
    } else {
        console.log(
            "Direct query successful, found",
            directMatches.length,
            "patterns"
        );
        if (directMatches.length > 0) {
            console.log(
                "Sample pattern embedding length:",
                directMatches[0].embedding.length
            );
        }
    }

    // Test with different thresholds using basic match_patterns
    const thresholds = [0.3, 0.5, 0.7, 0.85];

    for (const threshold of thresholds) {
        console.log(`\nTesting with threshold: ${threshold}`);

        try {
            // Try with just the required parameters first
            const { data: matches, error } = await supabase.rpc(
                "match_patterns",
                {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: 10,
                }
            );

            if (error) {
                console.error("Error:", error);
                continue;
            }

            console.log(`Found ${matches?.length || 0} matches`);

            if (matches && matches.length > 0) {
                matches.forEach((match, i) => {
                    console.log(`\nMatch ${i + 1}:`);
                    console.log(`- Pattern: ${match.pattern_name}`);
                    console.log(`- Type: ${match.type}`);
                    console.log(
                        `- Similarity: ${(match.similarity * 100).toFixed(2)}%`
                    );
                    console.log(`- Description: ${match.content.context}`);
                });
            }
        } catch (error) {
            console.error("Failed to execute match_patterns:", error);
        }
    }

    // Get all patterns for direct comparison
    console.log("\nFetching all patterns for direct comparison...");
    const { data: allPatterns, error: fetchError } = await supabase
        .from("vector_patterns")
        .select("*");

    if (fetchError) {
        console.error("Error fetching patterns:", fetchError);
        return;
    }

    console.log(
        `\nFound ${allPatterns?.length || 0} total patterns in database`
    );

    if (allPatterns) {
        console.log("\nPattern types in database:");
        const typeCount = allPatterns.reduce(
            (acc: Record<string, number>, pattern) => {
                acc[pattern.type] = (acc[pattern.type] || 0) + 1;
                return acc;
            },
            {}
        );
        console.log(typeCount);

        // Log a sample pattern to check its structure
        if (allPatterns.length > 0) {
            console.log("\nSample pattern structure:");
            const samplePattern = allPatterns[0];
            console.log({
                id: samplePattern.id,
                type: samplePattern.type,
                name: samplePattern.pattern_name,
                embedding_length: samplePattern.embedding?.length || 0,
                has_content: !!samplePattern.content,
                room_id: samplePattern.room_id,
            });
        }
    }
}

console.log("Running similarity test...");
testSimilarity()
    .then(() => {
        console.log("\nTest completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
    });
