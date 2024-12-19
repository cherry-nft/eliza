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
            prompt: "Create a racing game with neon graphics",
            userId: "test-user-1",
            sessionId,
            projectContext: "game-development",
        },
        {
            prompt: "Build a space shooter with power-ups",
            userId: "test-user-1",
            sessionId,
            projectContext: "game-development",
        },
    ];

    try {
        // Test storing prompt embeddings
        console.log("Testing prompt embedding storage...");
        for (const testData of testPrompts) {
            await vectorDb.storePromptEmbedding(testData);
            console.log(
                `Successfully stored embedding for prompt: "${testData.prompt}"`
            );
        }

        // Test retrieving similar prompts
        console.log("\nTesting prompt similarity search...");
        const searchEmbedding = await vectorDb.generatePromptEmbedding(
            "Make a racing game with glowing effects"
        );

        const { data: similarPrompts, error } = await vectorDb.supabase.rpc(
            "match_prompts_with_patterns",
            {
                query_embedding: searchEmbedding,
                match_threshold: 0.5,
                match_count: 5,
            }
        );

        if (error) throw error;

        console.log("\nSimilar prompts found:");
        console.log(similarPrompts);

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
