import { config } from "dotenv";
import fetch from "node-fetch";

// Load environment variables
config();

async function testPatternServer() {
    console.log("[Test] Starting pattern server test...");
    console.log(
        "[Test] Note: Make sure the server is running with 'pnpm run dev:server' in another terminal"
    );

    try {
        // Test health endpoint
        console.log("[Test] Testing health endpoint...");
        const healthResponse = await fetch(
            "http://localhost:3001/api/patterns/health"
        ).catch((error) => {
            if (error.code === "ECONNREFUSED") {
                console.error(
                    "[Test] Could not connect to server. Is it running? Use 'pnpm run dev:server' first"
                );
                process.exit(1);
            }
            throw error;
        });

        if (!healthResponse.ok) {
            throw new Error(
                `Health check failed with status ${healthResponse.status}`
            );
        }

        const healthData = await healthResponse.json();
        console.log("[Test] Health check response:", healthData);
        console.log("[Test] Basic health check completed successfully");

        // If health check passes, we can proceed with pattern generation test
        console.log(
            "\n[Test] Health check passed. Ready to test pattern generation."
        );
        console.log(
            "[Test] To test pattern generation, make sure VITE_OPENROUTER_API_KEY is set in .env"
        );
    } catch (error) {
        console.error("[Test] Test failed:", error);
        process.exit(1);
    }
}

// Run the test
testPatternServer();
