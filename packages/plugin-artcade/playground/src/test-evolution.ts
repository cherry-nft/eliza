import { VectorDatabase } from "../../src/services/VectorDatabase.js";
import {
    GamePattern,
    PatternStagingService,
} from "../../src/services/PatternStaging.js";
import { PatternEvolution } from "../../src/services/PatternEvolution.js";
import { elizaLogger } from "@ai16z/eliza";

class MockPatternStaging extends PatternStagingService {
    private patterns: Map<string, GamePattern> = new Map();

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

    async storePattern(pattern: GamePattern): Promise<void> {
        this.patterns.set(pattern.id, pattern);
    }

    async getPattern(id: string): Promise<GamePattern | null> {
        return this.patterns.get(id) || null;
    }
}

class MockVectorDatabase extends VectorDatabase {
    private patterns: Map<string, GamePattern> = new Map();

    async storePattern(pattern: GamePattern): Promise<void> {
        this.patterns.set(pattern.id, pattern);
        console.log("Stored pattern:", pattern.id);
    }

    async getPattern(id: string): Promise<GamePattern | null> {
        return this.patterns.get(id) || null;
    }

    async getPatternUsageStats(patternId: string): Promise<any> {
        const pattern = await this.getPattern(patternId);
        return {
            total_uses: pattern?.usage_count || 0,
            successful_uses: pattern?.usage_count || 0,
            average_similarity: 0.85,
            last_used: new Date(),
        };
    }
}

async function testPatternEvolution() {
    console.log("Starting Pattern Evolution Test");

    // Initialize services
    const vectorDb = new MockVectorDatabase();
    const stagingService = new MockPatternStaging();
    const evolutionService = new PatternEvolution();

    // Create base patterns
    const samplePattern: GamePattern = {
        id: "test-pattern-1",
        type: "animation",
        pattern_name: "test-animation",
        content: {
            html: `
                <div class="game-container">
                    <div class="game-element character">
                        <style>
                            .game-element {
                                animation: bounce 1s infinite;
                            }
                            @keyframes bounce {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-20px); }
                            }
                        </style>
                    </div>
                </div>
            `,
            css: "",
            js: "",
            context: "game",
            metadata: {
                visual_type: "animation",
                interaction_type: "character",
                color_scheme: ["#00ff00"],
                animation_duration: "1s",
            },
        },
        embedding: Array(1536).fill(0),
        effectiveness_score: 0.8,
        usage_count: 5,
    };

    const secondPattern: GamePattern = {
        id: "test-pattern-2",
        type: "animation",
        pattern_name: "test-animation-2",
        content: {
            html: `
                <div class="game-container">
                    <div class="game-element player">
                        <style>
                            .game-element {
                                animation: rotate 2s infinite;
                            }
                            @keyframes rotate {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                        </style>
                    </div>
                </div>
            `,
            css: "",
            js: "",
            context: "game",
            metadata: {
                visual_type: "animation",
                interaction_type: "player",
                color_scheme: ["#ff0000"],
                animation_duration: "2s",
            },
        },
        embedding: Array(1536).fill(0),
        effectiveness_score: 0.7,
        usage_count: 3,
    };

    // Create a population of patterns
    const patterns = [
        samplePattern,
        secondPattern,
        {
            ...samplePattern,
            id: "test-pattern-3",
            pattern_name: "test-animation-3",
            effectiveness_score: 0.6,
        },
        {
            ...secondPattern,
            id: "test-pattern-4",
            pattern_name: "test-animation-4",
            effectiveness_score: 0.5,
        },
    ];

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
            findSimilar: async () =>
                patterns.map((pattern, index) => ({
                    pattern,
                    similarity: 1 - index * 0.1,
                })),
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
    await evolutionService.initialize(runtime);

    // Store all patterns
    for (const pattern of patterns) {
        await stagingService.storePattern(pattern);
    }

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
        const currentResults = await evolutionService.evolvePattern(
            samplePattern,
            {
                populationSize: 4,
                generationLimit: 2,
                mutationRate: 0.1,
                crossoverRate: 0.5,
                elitismCount: 1,
                similarityThreshold: 0.7,
                fitnessThreshold: 0.8,
            }
        );
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
