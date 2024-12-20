import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { VectorSupabase } from "../services/VectorSupabase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

async function testSemanticPatternMatching() {
    console.log("\n🔍 Testing Semantic Pattern Matching");
    console.log("=================================");

    const vectorDb = new VectorSupabase(process.env.SUPABASE_PROJECT_URL || "");

    // First, let's check what patterns we have in the database
    console.log("\n📚 Checking existing patterns in database...");
    const allPatterns = await vectorDb.getAllPatterns();
    console.log(`Found ${allPatterns.length} patterns in database:`);
    allPatterns.forEach((pattern) => {
        console.log(`- ${pattern.pattern_name} (${pattern.type})`);
    });
    console.log("=================================\n");

    // Test cases with known patterns from our database
    const testCases = [
        {
            name: "Audio Visualization",
            prompt: "Build an audio visualization with waveform display",
            expectedPatterns: [
                "Audio Waveform Visualization",
                "Sound Control Interface",
            ],
        },
        {
            name: "Police Racing Game",
            prompt: "Create a police chase game with sirens and vehicle movement",
            expectedPatterns: [
                "Police Siren Alarm Audio System",
                "Advanced Vehicle Movement System",
                "Intelligent Police AI System",
            ],
        },
    ];

    for (const testCase of testCases) {
        console.log(`\n📋 Test Case: ${testCase.name}`);
        console.log(`Prompt: "${testCase.prompt}"`);
        console.log("\nGenerating embeddings and searching for patterns...");

        try {
            // First, let's get ALL patterns and their similarity scores
            const allPatterns = await vectorDb.findSimilarPatterns(
                testCase.prompt,
                0.0, // Set threshold to 0 to get ALL patterns
                100 // Increase limit to see more patterns
            );

            console.log(
                "\n📊 All Pattern Similarity Scores (sorted by similarity):"
            );
            console.log("------------------------------------------------");
            allPatterns
                .sort((a, b) => b.similarity - a.similarity)
                .forEach(({ pattern, similarity }) => {
                    const isExpected = testCase.expectedPatterns.includes(
                        pattern.pattern_name
                    );
                    console.log(
                        `${isExpected ? "✅" : "  "} ${similarity.toFixed(4)} - ${pattern.pattern_name}`
                    );
                    if (isExpected) {
                        console.log(`   Pattern Type: ${pattern.type}`);
                        console.log(`   Description: ${pattern.description}`);
                    }
                });

            // Now let's check which expected patterns were missed
            const foundPatterns = allPatterns.map(
                (p) => p.pattern.pattern_name
            );
            const missingPatterns = testCase.expectedPatterns.filter(
                (expected) => !foundPatterns.includes(expected)
            );

            if (missingPatterns.length > 0) {
                console.log("\n❌ Missing Expected Patterns:");
                missingPatterns.forEach((pattern) =>
                    console.log(`- ${pattern}`)
                );
            }

            console.log("\n------------------------------------------------");
        } catch (error) {
            console.error(`\n❌ Error in test case "${testCase.name}":`, error);
        }
    }
}

// Run the test
testSemanticPatternMatching().catch(console.error);
