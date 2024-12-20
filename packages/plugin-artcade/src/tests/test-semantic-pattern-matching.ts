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
        if (pattern.room_id) {
            const tags = pattern.room_id.split("-");
            console.log("  Tags:");
            console.log("  • Use Cases:", tags[0]?.replace(/_/g, " "));
            console.log("  • Mechanics:", tags[1]?.replace(/_/g, " "));
            console.log("  • Interactions:", tags[2]?.replace(/_/g, " "));
            console.log("  • Visual Style:", tags[3]?.replace(/_/g, " "));
        }
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
            // Use the prompt directly for semantic search
            const matchedPatterns = await vectorDb.findSimilarPatterns(
                testCase.prompt,
                0.3,
                100
            );

            if (matchedPatterns.length > 0) {
                console.log("\n📊 Pattern Matches (sorted by similarity):");
                console.log("------------------------------------------------");
                matchedPatterns
                    .sort((a, b) => b.similarity - a.similarity)
                    .forEach(({ pattern, similarity }) => {
                        const isExpected = testCase.expectedPatterns.includes(
                            pattern.pattern_name
                        );
                        console.log(
                            `\n${isExpected ? "✅" : "  "} ${pattern.pattern_name} (${pattern.type})`
                        );
                        console.log(`   Score: ${similarity.toFixed(4)}`);

                        if (pattern.room_id) {
                            const tags = pattern.room_id.split("-");
                            console.log("   Semantic Tags:");
                            console.log(
                                "   • Use Cases:",
                                tags[0]?.replace(/_/g, " ")
                            );
                            console.log(
                                "   • Mechanics:",
                                tags[1]?.replace(/_/g, " ")
                            );
                            console.log(
                                "   • Interactions:",
                                tags[2]?.replace(/_/g, " ")
                            );
                            console.log(
                                "   • Visual Style:",
                                tags[3]?.replace(/_/g, " ")
                            );
                        }
                    });

                // Check for missing expected patterns
                const foundPatterns = matchedPatterns.map(
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
                } else {
                    console.log("\n✅ All expected patterns found!");
                }
            } else {
                console.log("\n❌ No patterns found matching the criteria");
            }

            console.log("\n------------------------------------------------");
        } catch (error) {
            console.error(`\n❌ Error in test case "${testCase.name}":`, error);
        }
    }
}

// Run the test
testSemanticPatternMatching().catch(console.error);
