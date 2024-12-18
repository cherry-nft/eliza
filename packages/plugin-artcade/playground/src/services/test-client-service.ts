import { clientPatternService } from "./ClientPatternService";
import { PatternGenerationError } from "../shared/types/pattern.types";

async function testClientService() {
    console.log("[Test] Starting client service test...");
    console.log(
        "[Test] Note: Make sure the server is running with 'pnpm run dev:server' in another terminal"
    );

    try {
        // Test health check
        console.log("\n[Test] Testing health check...");
        const isHealthy = await clientPatternService.healthCheck();

        if (!isHealthy) {
            console.error("[Test] Health check failed. Is the server running?");
            process.exit(1);
        }

        console.log("[Test] Health check passed successfully");

        // Test pattern generation with timeout
        console.log("\n[Test] Testing pattern generation...");
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new Error("Pattern generation timed out after 30s")
                        ),
                    30000
                )
            );

            const patternPromise = clientPatternService.generatePattern(
                "Create a simple bouncing ball animation"
            );

            const pattern = await Promise.race([
                patternPromise,
                timeoutPromise,
            ]);

            console.log("\n[Test] Pattern generation response received:");
            console.log("----------------------------------------");
            if (pattern) {
                console.log("Title:", pattern.title || "No title");
                console.log(
                    "Description:",
                    pattern.description || "No description"
                );
                console.log(
                    "HTML Length:",
                    pattern.html?.length || 0,
                    "characters"
                );
                console.log(
                    "Core Mechanics:",
                    pattern.plan?.coreMechanics || "None specified"
                );
                console.log("----------------------------------------");
            } else {
                throw new Error("Pattern is undefined");
            }
        } catch (error) {
            console.error("\n[Test] Pattern generation error:");
            console.error("----------------------------------------");
            if (error instanceof PatternGenerationError) {
                console.error("Type: PatternGenerationError");
                console.error("Message:", error.message);
                console.error("Details:", error.details);
            } else {
                console.error("Type:", error.constructor.name);
                console.error("Message:", error.message);
                console.error("Stack:", error.stack);
            }
            console.error("----------------------------------------");
            throw error;
        }

        console.log("\n[Test] All tests completed successfully!");
    } catch (error) {
        console.error("\n[Test] Test suite failed:", error);
        process.exit(1);
    }
}

// Run the test
console.log("[Test] Node version:", process.version);
console.log("[Test] Current working directory:", process.cwd());
testClientService().catch((error) => {
    console.error("[Test] Unhandled error:", error);
    process.exit(1);
});
