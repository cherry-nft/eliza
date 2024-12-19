import { VectorSupabase } from "../services/VectorSupabase";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config();

async function testPromptEmbeddings() {
    if (!process.env.SUPABASE_PROJECT_URL) {
        throw new Error("Missing SUPABASE_PROJECT_URL environment variable");
    }

    console.log("Starting prompt embeddings test...");
    const vectorDb = new VectorSupabase(process.env.SUPABASE_PROJECT_URL);

    // Test data
    const sessionId = uuidv4();
    const testPrompts = [
        {
            prompt: "Create a music visualizer with pulsing neon bars that react to the beat",
            userId: "test-user-1",
            sessionId,
            projectContext: "audio-visualization",
        },
        {
            prompt: "Build a top-down racing game with drifting mechanics and speed trails",
            userId: "test-user-1",
            sessionId,
            projectContext: "game-development",
        },
    ];

    try {
        // Test storing prompt embeddings
        console.log("Testing prompt embedding storage...");
        for (const testData of testPrompts) {
            const startTime = Date.now();
            await vectorDb.storePromptEmbedding({
                ...testData,
                responseTime: Date.now() - startTime,
            });
            console.log(
                `Successfully stored embedding for prompt: "${testData.prompt}"`
            );
        }

        // Test retrieving similar patterns
        console.log("\nTesting pattern similarity search...");
        const searchQuery =
            "Create a racing game with neon effects and drifting";
        const similarPatterns = await vectorDb.findSimilarPatterns(
            searchQuery,
            0.5, // threshold
            5 // limit
        );

        console.log("\nSimilar patterns found:");
        console.log(similarPatterns);

        // Test updating prompt match results
        if (similarPatterns.length > 0) {
            const testPromptId = uuidv4(); // In real usage, this would be the ID from storePromptEmbedding
            await vectorDb.updatePromptMatchResults(testPromptId, {
                matchedPatternIds: similarPatterns.map((pattern) => pattern.id),
                selectedPatternId: similarPatterns[0].id,
                successScore: 0.85,
                userFeedback: "Great match!",
            });
            console.log("\nSuccessfully updated prompt match results");
        }

        console.log("\nPrompt embeddings test completed successfully!");
    } catch (error) {
        console.error("Error during prompt embeddings test:", error);
        throw error;
    }
}

// Run the test
testPromptEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
    });
