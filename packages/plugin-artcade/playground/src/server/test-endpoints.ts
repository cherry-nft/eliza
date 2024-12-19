import { config } from "dotenv";
import { randomUUID } from "crypto";
import type {
    GeneratedPattern,
    PatternStorageRequest,
    SimilarPatternsRequest,
    PatternUsageContext,
} from "../shared/pattern.types";

// Load environment variables
config();

const BASE_URL = "http://localhost:3001/api/patterns";

async function testEndpoints() {
    console.log("[Test] Starting endpoint integration test...");

    try {
        // Test 1: Health Check
        console.log("\n[Test] Testing health endpoint...");
        const healthResponse = await fetch(`${BASE_URL}/health`);
        if (!healthResponse.ok) throw new Error("Health check failed");
        console.log("[Test] Health check passed");

        // Test 2: Generate Pattern
        console.log("\n[Test] Testing pattern generation...");
        const generationResponse = await fetch(`${BASE_URL}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: "Create a simple button that pulses with a subtle glow effect when hovered",
            }),
        });

        if (!generationResponse.ok)
            throw new Error("Pattern generation failed");
        const generatedPattern: { success: boolean; data: GeneratedPattern } =
            await generationResponse.json();
        console.log("[Test] Pattern generated successfully:", {
            title: generatedPattern.data.title,
            htmlLength: generatedPattern.data.html.length,
        });

        // Test 3: Store Pattern
        console.log("\n[Test] Testing pattern storage...");
        const storageRequest: PatternStorageRequest = {
            type: "ui",
            pattern_name: generatedPattern.data.title,
            content: {
                html: generatedPattern.data.html,
            },
        };

        const storageResponse = await fetch(`${BASE_URL}/store`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(storageRequest),
        });

        if (!storageResponse.ok) throw new Error("Pattern storage failed");
        const storedPattern = await storageResponse.json();
        const patternId = storedPattern.data.id;
        console.log("[Test] Pattern stored successfully with ID:", patternId);

        // Test 4: Retrieve Pattern
        console.log("\n[Test] Testing pattern retrieval...");
        const retrievalResponse = await fetch(`${BASE_URL}/${patternId}`);
        if (!retrievalResponse.ok) throw new Error("Pattern retrieval failed");
        const retrievedPattern = await retrievalResponse.json();
        console.log("[Test] Pattern retrieved successfully:", {
            id: retrievedPattern.data.id,
            name: retrievedPattern.data.pattern_name,
        });

        // Test 5: Similar Pattern Search by ID
        console.log("\n[Test] Testing similar pattern search by ID...");
        const searchRequest: SimilarPatternsRequest = {
            patternId,
            type: "ui",
            threshold: 0.85,
            limit: 5,
        };

        const searchResponse = await fetch(`${BASE_URL}/search/similar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(searchRequest),
        });

        if (!searchResponse.ok)
            throw new Error("Similar pattern search failed");
        const similarPatterns = await searchResponse.json();
        console.log(
            "[Test] Similar patterns found:",
            similarPatterns.data.length
        );

        // Test 6: Similar Pattern Search by HTML
        console.log("\n[Test] Testing similar pattern search by HTML...");
        const htmlSearchRequest: SimilarPatternsRequest = {
            html: generatedPattern.data.html,
            type: "ui",
            threshold: 0.85,
            limit: 5,
        };

        const htmlSearchResponse = await fetch(`${BASE_URL}/search/similar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(htmlSearchRequest),
        });

        if (!htmlSearchResponse.ok)
            throw new Error("HTML-based pattern search failed");
        const htmlSimilarPatterns = await htmlSearchResponse.json();
        console.log(
            "[Test] Similar patterns found by HTML:",
            htmlSimilarPatterns.data.length
        );

        // Test 7: Track Pattern Usage
        console.log("\n[Test] Testing pattern usage tracking...");
        const usageContext: PatternUsageContext = {
            prompt: "Create a glowing button",
            generated_html: generatedPattern.data.html,
            quality_scores: {
                visual: 0.9,
                interactive: 0.85,
                functional: 0.95,
                performance: 0.9,
            },
        };

        const usageResponse = await fetch(
            `${BASE_URL}/${patternId}/track-usage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(usageContext),
            }
        );

        if (!usageResponse.ok) throw new Error("Usage tracking failed");
        const usageResult = await usageResponse.json();
        console.log("[Test] Usage tracked successfully:", {
            newScore: usageResult.data.new_score,
            usageCount: usageResult.data.usage_count,
        });

        console.log("\n[Test] All endpoint tests completed successfully! 🎉");
        process.exit(0);
    } catch (error) {
        console.error("\n[Test] Test failed:", error);
        process.exit(1);
    }
}

// Run the test
console.log("[Test] Starting endpoint tests...");
console.log("[Test] Server URL:", BASE_URL);
testEndpoints();
