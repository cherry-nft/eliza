import { patternService } from "./services/PG-PatternService";

async function runTest() {
    try {
        console.log("1. Initializing pattern service...");
        await patternService.initialize();

        console.log("2. Getting all patterns...");
        const patterns = await patternService.getPatterns();
        console.log(`Found ${patterns.length} patterns`);

        const testPrompt =
            "Create a pattern that shows a loading animation with a pulsing circle";
        console.log(`\n3. Generating pattern from prompt: "${testPrompt}"`);
        const generatedHtml =
            await patternService.generateFromPrompt(testPrompt);
        console.log("Generated HTML:", generatedHtml.substring(0, 100) + "...");

        if (patterns.length > 0) {
            console.log("\n4. Testing similar pattern search...");
            const similarPatterns = await patternService.searchSimilarPatterns(
                patterns[0]
            );
            console.log(`Found ${similarPatterns.length} similar patterns`);

            console.log("\n5. Testing pattern comparison...");
            const metrics = await patternService.comparePatterns(
                generatedHtml,
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
    }
}

// Run the test
runTest();
