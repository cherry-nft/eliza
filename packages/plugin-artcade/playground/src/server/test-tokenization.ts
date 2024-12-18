import { TokenizationService } from "./services/TokenizationService";
import fetch from "node-fetch";
import { config } from "dotenv";

// Load environment variables
config();

async function testTokenization() {
    console.log("[Test] Starting tokenization tests...");
    console.log(
        "[Test] Note: Make sure the server is running with 'pnpm run dev:server'"
    );

    try {
        // Test 1: Direct Service Test
        console.log("\n[Test] Testing TokenizationService directly...");
        const service = new TokenizationService();
        await service.initialize();

        const testText = "<button class='test'>Click me</button>";
        const directResult = await service.tokenize(testText);
        console.log("[Test] Direct tokenization successful:", {
            inputText: testText,
            tokenCount: directResult.tokenCount,
            firstFewTokens: directResult.tokens.slice(0, 5),
        });

        // Test 2: Health Check
        console.log("\n[Test] Testing service health check...");
        const isHealthy = await service.healthCheck();
        if (!isHealthy) {
            throw new Error("Health check failed");
        }
        console.log("[Test] Health check passed");

        // Test 3: API Endpoint Test
        console.log("\n[Test] Testing tokenization endpoint...");
        const response = await fetch(
            "http://localhost:3001/api/patterns/tokenize",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: testText }),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Endpoint test failed with status ${response.status}`
            );
        }

        const apiResult = await response.json();
        console.log("[Test] API tokenization successful:", {
            success: apiResult.success,
            tokenCount: apiResult.data.tokenCount,
            firstFewTokens: apiResult.data.tokens.slice(0, 5),
        });

        // Test 4: Compare Results
        console.log("\n[Test] Comparing direct and API results...");
        const directTokens = directResult.tokens;
        const apiTokens = apiResult.data.tokens;

        const tokensMatch =
            directTokens.length === apiTokens.length &&
            directTokens.every((token, index) => token === apiTokens[index]);

        if (!tokensMatch) {
            throw new Error("Direct and API results don't match");
        }
        console.log("[Test] Results match perfectly");

        // Test 5: Error Cases
        console.log("\n[Test] Testing error cases...");

        // Invalid input
        const invalidResponse = await fetch(
            "http://localhost:3001/api/patterns/tokenize",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: null }),
            }
        );

        if (invalidResponse.status !== 400) {
            throw new Error("Invalid input test failed");
        }
        console.log("[Test] Invalid input handled correctly");

        // Cleanup
        await service.cleanup();
        console.log(
            "\n[Test] All tokenization tests completed successfully! 🎉"
        );
    } catch (error) {
        console.error("\n[Test] Test failed:", error);
        if (error instanceof Error) {
            console.error("[Test] Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        process.exit(1);
    }
}

// Run the test
console.log("[Test] Starting tokenization test suite...");
testTokenization();
