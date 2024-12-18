import { VectorDatabase } from "../../src/services/VectorDatabase.js";
import {
    GamePattern,
    PatternStagingService,
} from "../../src/services/PatternStaging.js";
import { PatternEvolution } from "../../src/services/PatternEvolution.js";
import { elizaLogger } from "@ai16z/eliza";

class MockPatternStaging extends PatternStagingService {
    async validatePattern(pattern: GamePattern): Promise<GamePattern> {
        // Basic validation
        const isValid =
            pattern &&
            pattern.type &&
            pattern.pattern_name &&
            pattern.content &&
            pattern.content.html;

        if (!isValid) {
            throw new Error("Invalid pattern");
        }

        return pattern;
    }
}

async function testPatternEvolution() {
    console.log("Starting Pattern Evolution Test");

    // Initialize services with runtime
    const vectorDb = new VectorDatabase();
    const stagingService = new MockPatternStaging();
    const runtime = {
        logger: elizaLogger,
        getDatabaseAdapter: () => ({
            query: async () => ({ rows: [] }),
            transaction: async (fn) =>
                fn({ query: async () => ({ rows: [] }) }),
        }),
        getEmbeddingCache: () => ({
            get: async () => null,
            set: async () => {},
            delete: async () => {},
        }),
        getVectorOperations: () => ({
            initialize: async () => {},
            findSimilar: async () => [],
        }),
        getService: (ServiceClass) => {
            if (ServiceClass === VectorDatabase) return vectorDb;
            if (ServiceClass === PatternEvolution) return evolutionService;
            if (ServiceClass === PatternStagingService) return stagingService;
            return null;
        },
    };

    await vectorDb.initialize(runtime);
    await stagingService.initialize(runtime);
    const evolutionService = new PatternEvolution();
    await evolutionService.initialize(runtime);

    // Sample pattern for testing
    const samplePattern: GamePattern = {
        id: "test-pattern-1",
        type: "animation",
        pattern_name: "test-animation",
        content: {
            html: `
                <div class="animated-element">
                    <style>
                        .animated-element {
                            animation: bounce 1s infinite;
                        }
                        @keyframes bounce {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-20px); }
                        }
                    </style>
                </div>
            `,
        },
        embedding: Array(1536).fill(0), // Initialize with proper dimension
        effectiveness_score: 0.8,
        usage_count: 5,
    };

    console.log("Testing with sample pattern:", samplePattern.pattern_name);

    try {
        // 1. Extract features and generate embedding
        console.log("\nExtracting features...");
        const features = await vectorDb.extractPatternFeatures(
            samplePattern.content.html
        );
        console.log("Extracted features:", features);

        // 2. Find similar patterns - Embedding-based approach
        console.log("\nFinding similar patterns (embedding-based)...");
        const similarPatterns = await vectorDb.findSimilarPatterns(
            samplePattern.embedding,
            samplePattern.type,
            0.8,
            5
        );
        console.log("Similar patterns found:", similarPatterns.length);
        console.log(
            "Similarity scores:",
            similarPatterns.map((p) => p.similarity)
        );

        // 3. Compare with current implementation
        console.log("\nComparing with current implementation...");
        const currentResults =
            await evolutionService.evolvePattern(samplePattern);
        console.log("Current implementation results:", currentResults);

        // 4. Analyze differences
        console.log("\nAnalyzing differences between approaches:");
        console.log("- Embedding-based matches:", similarPatterns.length);
        console.log(
            "- Current implementation matches:",
            currentResults ? 1 : 0
        );

        // 5. Performance metrics
        console.log("\nPerformance metrics:");
        const metrics = await vectorDb.getPatternUsageStats(samplePattern.id);
        console.log("Pattern usage stats:", metrics);
    } catch (error) {
        console.error("Error during testing:", error);
    }
}

// Run the test
testPatternEvolution().catch(console.error);
