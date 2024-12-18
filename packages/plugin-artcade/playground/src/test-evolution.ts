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
        console.log("Validating pattern:", {
            id: pattern.id,
            type: pattern.type,
            hasContent: !!pattern.content,
            hasHtml: !!pattern?.content?.html,
            hasMetadata: !!pattern?.content?.metadata,
        });

        // Basic validation
        const isValid =
            pattern &&
            pattern.type &&
            pattern.pattern_name &&
            pattern.content &&
            pattern.content.html;

        if (!isValid) {
            console.error("Pattern validation failed:", {
                pattern: JSON.stringify(pattern, null, 2),
            });
            throw new Error("Invalid pattern");
        }

        return pattern;
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        console.log("Storing pattern:", {
            id: pattern.id,
            name: pattern.pattern_name,
            type: pattern.type,
        });
        this.patterns.set(pattern.id, pattern);
    }

    async getPattern(id: string): Promise<GamePattern | null> {
        const pattern = this.patterns.get(id);
        console.log("Retrieved pattern:", {
            id,
            found: !!pattern,
            type: pattern?.type,
        });
        return pattern || null;
    }
}

class MockVectorDatabase extends VectorDatabase {
    private patterns: Map<string, GamePattern> = new Map();

    async storePattern(pattern: GamePattern): Promise<void> {
        console.log("VectorDB storing pattern:", {
            id: pattern.id,
            name: pattern.pattern_name,
            type: pattern.type,
        });
        this.patterns.set(pattern.id, pattern);
    }

    async getPattern(id: string): Promise<GamePattern | null> {
        const pattern = this.patterns.get(id);
        console.log("VectorDB retrieved pattern:", {
            id,
            found: !!pattern,
            type: pattern?.type,
        });
        return pattern || null;
    }

    async getPatternUsageStats(patternId: string): Promise<any> {
        const pattern = await this.getPattern(patternId);
        console.log("Getting usage stats for pattern:", {
            id: patternId,
            found: !!pattern,
        });
        return {
            total_uses: pattern?.usage_count || 0,
            successful_uses: pattern?.usage_count || 0,
            average_similarity: 0.85,
            last_used: new Date(),
        };
    }

    async findSimilarPatterns(
        embedding: number[],
        type: string,
        threshold: number,
        limit: number = 5
    ): Promise<any[]> {
        console.log("Finding similar patterns:", {
            type,
            threshold,
            limit,
            embeddingLength: embedding?.length,
        });

        // Return array of patterns from our stored patterns
        const patterns = Array.from(this.patterns.values())
            .filter((p) => p.type === type)
            .slice(0, limit)
            .map((pattern) => ({
                pattern,
                similarity: 0.9,
            }));

        console.log("Found similar patterns:", {
            count: patterns.length,
            patterns: patterns.map((p) => ({
                id: p.pattern.id,
                type: p.pattern.type,
                similarity: p.similarity,
            })),
        });

        return patterns;
    }

    async extractPatternFeatures(html: string): Promise<any> {
        console.log("Extracting features from HTML:", {
            htmlLength: html?.length,
        });
        return {
            elementCount: (html.match(/<[^>]+>/g) || []).length,
            styleCount: (html.match(/<style[^>]*>/g) || []).length,
            scriptCount: (html.match(/<script[^>]*>/g) || []).length,
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
                <!DOCTYPE html>
                <html>
                <body>
                    <div class="game-container">
                        <div class="game-element character">
                            <div class="sprite"></div>
                        </div>
                        <style>
                            .game-container {
                                width: 100%;
                                height: 100%;
                                position: relative;
                                background: #f0f0f0;
                            }
                            .game-element {
                                position: absolute;
                                width: 50px;
                                height: 50px;
                                background: #00ff00;
                                animation: bounce 1s infinite;
                            }
                            .sprite {
                                width: 100%;
                                height: 100%;
                            }
                            @keyframes bounce {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-20px); }
                            }
                        </style>
                    </div>
                </body>
                </html>
            `,
            css: "",
            js: "",
            context: "game",
            metadata: {
                visual_type: "animation",
                interaction_type: "character",
                color_scheme: ["#00ff00", "#f0f0f0"],
                animation_duration: "1s",
            },
        },
        embedding: Array(1536).fill(0),
        effectiveness_score: 0.8,
        usage_count: 5,
    };

    console.log("Created sample pattern:", {
        id: samplePattern.id,
        type: samplePattern.type,
        hasContent: !!samplePattern.content,
        hasHtml: !!samplePattern?.content?.html,
        hasMetadata: !!samplePattern?.content?.metadata,
    });

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
            initialize: async () => {
                console.log("Initializing vector operations");
            },
            findSimilar: async () => {
                console.log("Finding similar patterns");
                return [samplePattern].map((pattern, index) => ({
                    pattern,
                    similarity: 1 - index * 0.1,
                }));
            },
        }),
        getService: (ServiceClass) => {
            console.log("Getting service:", ServiceClass.name);
            if (ServiceClass === VectorDatabase) return vectorDb;
            if (ServiceClass === PatternEvolution) return evolutionService;
            if (ServiceClass === PatternStagingService) return stagingService;
            return null;
        },
    };

    console.log("Initializing services...");
    await vectorDb.initialize(runtime);
    await stagingService.initialize(runtime);
    await evolutionService.initialize(runtime);
    console.log("Services initialized");

    // Store pattern
    console.log("Storing sample pattern...");
    await stagingService.storePattern(samplePattern);
    console.log("Sample pattern stored");

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
        console.log("Similar patterns found:", {
            count: similarPatterns.length,
            patterns: similarPatterns.map((p) => ({
                id: p.pattern.id,
                type: p.pattern.type,
                similarity: p.similarity,
            })),
        });

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
        console.log("Current implementation results:", {
            generation: currentResults.generation,
            fitness: currentResults.fitness,
            pattern: {
                id: currentResults.pattern.id,
                type: currentResults.pattern.type,
                hasContent: !!currentResults.pattern.content,
                hasHtml: !!currentResults.pattern?.content?.html,
            },
        });

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

        console.log("\nTest completed successfully");
    } catch (error) {
        console.error("Test failed:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

// Run the test
console.log("Starting test execution...");
testPatternEvolution().catch((error) => {
    console.error("Test failed:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
    });
});
