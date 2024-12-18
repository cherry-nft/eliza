import { clientPatternService } from "./services/ClientPatternService";

async function runTest() {
    try {
        console.log("1. Checking pattern service health...");
        const isHealthy = await clientPatternService.healthCheck();
        if (!isHealthy) {
            throw new Error("Pattern service health check failed");
        }

        console.log("2. Getting all patterns...");
        const patterns = await clientPatternService.getAllPatterns();
        console.log(`Found ${patterns.length} patterns`);

        const testPrompt =
            "Create a pattern that shows a loading animation with a pulsing circle";
        console.log(`\n3. Generating pattern from prompt: "${testPrompt}"`);
        const generatedPattern =
            await clientPatternService.generatePattern(testPrompt);
        console.log("Generated pattern:", {
            title: generatedPattern.title,
            description: generatedPattern.description,
            html: generatedPattern.html.substring(0, 100) + "...",
        });

        if (patterns.length > 0) {
            console.log("\n4. Testing similar pattern search...");
            const similarPatterns =
                await clientPatternService.findSimilarPatterns(patterns[0]);
            console.log(`Found ${similarPatterns.length} similar patterns`);

            console.log("\n5. Testing pattern comparison...");
            const metrics = await clientPatternService.comparePatterns(
                generatedPattern.html,
                patterns[0]
            );
            console.log(
                "Comparison metrics:",
                JSON.stringify(metrics, null, 2)
            );
        }

        console.log("\nTest completed successfully! ✅");
    } catch (error) {
        console.error("Test failed:", error);
        if (error instanceof Error) {
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
    }
}

// Run the test
runTest();
