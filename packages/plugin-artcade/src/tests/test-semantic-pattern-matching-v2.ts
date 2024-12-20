import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { VectorSupabase } from "../services/VectorSupabase";
import { GamePattern } from "../types/patterns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

interface TestCase {
    name: string;
    prompt: string;
    expectedPatterns: string[];
}

interface TestResult {
    pattern_name: string;
    type: string;
    similarity: number;
}

async function runOriginalTest(
    vectorDb: VectorSupabase,
    testCase: TestCase
): Promise<TestResult[]> {
    console.log(`\n📋 Original Test Case: ${testCase.name}`);
    console.log(`Prompt: "${testCase.prompt}"`);

    const matchedPatterns = await vectorDb.findSimilarPatterns(
        testCase.prompt,
        0.3,
        100
    );

    return matchedPatterns.map(({ pattern, similarity }) => ({
        pattern_name: pattern.pattern_name,
        type: pattern.type,
        similarity,
    }));
}

async function runDirectTest(
    vectorDb: VectorSupabase,
    testCase: TestCase
): Promise<TestResult[]> {
    console.log(`\n📋 Direct Test Case: ${testCase.name}`);
    console.log(`Prompt: "${testCase.prompt}"`);

    const matchedPatterns = await vectorDb.findSimilarPatterns(
        testCase.prompt,
        0.3,
        100
    );

    return matchedPatterns.map(({ pattern, similarity }) => ({
        pattern_name: pattern.pattern_name,
        type: pattern.type,
        similarity,
    }));
}

function compareResults(v1Results: TestResult[], v2Results: TestResult[]) {
    console.log("\n🔍 Comparing Results:");
    console.log("=================================");

    // Check if same number of results
    if (v1Results.length !== v2Results.length) {
        console.log(
            `❌ Result count mismatch: v1=${v1Results.length}, v2=${v2Results.length}`
        );
    } else {
        console.log(`✅ Result count matches: ${v1Results.length}`);
    }

    // Compare each result
    const maxLength = Math.max(v1Results.length, v2Results.length);
    for (let i = 0; i < maxLength; i++) {
        const v1 = v1Results[i];
        const v2 = v2Results[i];

        if (!v1 || !v2) {
            console.log(`\n❌ Missing result at position ${i}`);
            if (v1)
                console.log(
                    `  v1: ${v1.pattern_name} (${v1.similarity.toFixed(4)})`
                );
            if (v2)
                console.log(
                    `  v2: ${v2.pattern_name} (${v2.similarity.toFixed(4)})`
                );
            continue;
        }

        console.log(`\nComparing result ${i + 1}:`);
        console.log(`  Pattern: ${v1.pattern_name}`);

        if (v1.pattern_name === v2.pattern_name) {
            console.log("  ✅ Pattern name matches");
        } else {
            console.log(`  ❌ Pattern name mismatch: v2=${v2.pattern_name}`);
        }

        if (v1.type === v2.type) {
            console.log("  ✅ Type matches");
        } else {
            console.log(`  ❌ Type mismatch: v1=${v1.type}, v2=${v2.type}`);
        }

        const similarityDiff = Math.abs(v1.similarity - v2.similarity);
        if (similarityDiff < 0.0001) {
            console.log(`  ✅ Similarity matches: ${v1.similarity.toFixed(4)}`);
        } else {
            console.log(
                `  ❌ Similarity differs: v1=${v1.similarity.toFixed(4)}, v2=${v2.similarity.toFixed(4)}`
            );
        }
    }
}

async function testSemanticPatternMatchingV2() {
    console.log("\n🔍 Testing Direct VectorSupabase Pattern Matching");
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

    // Test cases with known patterns from our database
    const testCases: TestCase[] = [
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

    // Store results from both versions
    const v1Results: Record<string, TestResult[]> = {};
    const v2Results: Record<string, TestResult[]> = {};

    // Run both tests
    for (const testCase of testCases) {
        // Run original test first
        v1Results[testCase.name] = await runOriginalTest(vectorDb, testCase);

        // Then run direct test
        v2Results[testCase.name] = await runDirectTest(vectorDb, testCase);
    }

    // Compare results
    for (const testCase of testCases) {
        console.log(`\n📊 Results for: ${testCase.name}`);
        console.log("------------------------------------------------");
        compareResults(v1Results[testCase.name], v2Results[testCase.name]);
    }
}

testSemanticPatternMatchingV2().catch(console.error);
