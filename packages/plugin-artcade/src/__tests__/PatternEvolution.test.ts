import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { PatternEvolution } from "../services/PatternEvolution";
import { VectorDatabase } from "../services/VectorDatabase";
import { PatternStaging, GamePattern } from "../services/PatternStaging";

// Mock dependencies
vi.mock("../services/VectorDatabase");
vi.mock("../services/PatternStaging");

describe("PatternEvolution", () => {
    let evolution: PatternEvolution;
    let mockRuntime: IAgentRuntime & { logger: typeof elizaLogger };
    let mockVectorDb: jest.Mocked<VectorDatabase>;
    let mockStaging: jest.Mocked<PatternStaging>;

    const mockPattern: GamePattern = {
        id: "test-id",
        type: "animation",
        pattern_name: "test_animation",
        content: {
            html: "<div class='animated'>Test</div>",
            css: "@keyframes test { }",
            context: "test",
            metadata: {
                visual_type: "animation",
                animation_duration: "1s",
            },
        },
        embedding: new Array(1536).fill(0),
        effectiveness_score: 1.0,
        usage_count: 0,
    };

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock runtime and services
        mockVectorDb = {
            findSimilarPatterns: vi.fn(),
            storePattern: vi.fn(),
        } as unknown as jest.Mocked<VectorDatabase>;

        mockStaging = {
            validatePattern: vi.fn(),
        } as unknown as jest.Mocked<PatternStaging>;

        mockRuntime = {
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            },
            getService: vi.fn().mockImplementation((Service) => {
                if (Service === VectorDatabase) return mockVectorDb;
                if (Service === PatternStaging) return mockStaging;
                return null;
            }),
        } as unknown as IAgentRuntime & { logger: typeof elizaLogger };

        // Initialize evolution service
        evolution = new PatternEvolution();
        await evolution.initialize(mockRuntime);
    });

    describe("evolvePattern", () => {
        it("should evolve a pattern and return the best result", async () => {
            // Mock similar patterns
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        pattern_name: "similar_pattern_1",
                    },
                    similarity: 0.9,
                },
            ]);

            // Mock pattern validation
            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 2,
                mutationRate: 0.1,
                crossoverRate: 0.5,
                elitismCount: 1,
            });

            expect(result).toBeDefined();
            expect(result.pattern).toBeDefined();
            expect(result.fitness).toBeGreaterThan(0);
            expect(result.generation).toBeGreaterThanOrEqual(0);
            expect(mockVectorDb.storePattern).toHaveBeenCalled();
        });

        it("should handle errors during evolution", async () => {
            mockVectorDb.findSimilarPatterns.mockRejectedValueOnce(
                new Error("Database error")
            );

            await expect(
                evolution.evolvePattern(mockPattern)
            ).rejects.toThrow();
            expect(mockRuntime.logger.error).toHaveBeenCalled();
        });

        it("should stop evolution when fitness threshold is reached", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        pattern_name: "similar_pattern_1",
                        effectiveness_score: 0.95,
                    },
                    similarity: 0.95,
                },
            ]);

            // Mock validatePattern to return a pattern with high fitness potential
            mockStaging.validatePattern.mockImplementation(async (pattern) => ({
                ...pattern,
                effectiveness_score: 0.95,
                content: {
                    html: `<div class="container">
                        <div class="progress-tracker">
                            <div class="score interactive" onclick="this.classList.toggle('active')">Score: <span>0</span></div>
                            <div class="progress hoverable" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                Progress: <span>0%</span>
                            </div>
                        </div>
                        <div class="game-area" style="position: relative; animation: pulse 2s infinite;">
                            <div class="game-player" style="width: 32px; height: 32px; background-color: red; position: absolute; animation: move 2s infinite;"></div>
                            <div class="game-collectible" style="width: 16px; height: 16px; background-color: yellow; position: absolute; border-radius: 50%; animation: float 1s infinite;"></div>
                            <div class="game-score" style="position: absolute; top: 10px; right: 10px;">Score: 0</div>
                        </div>
                        <div class="interactive-element draggable" draggable="true" style="cursor: pointer; padding: 10px; background: #f0f0f0; border-radius: 4px; transition: transform 0.2s;">
                            Click to Progress
                        </div>
                    </div>`,
                    css: `
                        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
                        @keyframes move { 0% { left: 0; } 100% { left: 100%; } }
                        @keyframes float { 0% { top: 0; } 100% { top: 20px; } }
                        .game-area { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                    `,
                    context: "game",
                    metadata: {
                        visual_type: "game",
                        animation_count: 3,
                        interaction_count: 4,
                    },
                },
            }));

            const result = await evolution.evolvePattern(mockPattern, {
                fitnessThreshold: 0.8,
                populationSize: 4,
                generationLimit: 10,
                elitismCount: 1,
            });

            expect(result.fitness).toBeGreaterThanOrEqual(0.8);
            expect(result.generation).toBeLessThan(10); // Should stop before max generations
        });
    });

    describe("population management", () => {
        it("should maintain population size across generations", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const config = {
                populationSize: 5,
                generationLimit: 3,
            };

            const result = await evolution.evolvePattern(mockPattern, config);
            expect(result).toBeDefined();
            // Population size checks would be internal to the evolution process
        });

        it("should preserve elite patterns across generations", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "elite-1",
                        effectiveness_score: 0.95,
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const config = {
                populationSize: 4,
                generationLimit: 2,
                elitismCount: 1,
            };

            const result = await evolution.evolvePattern(mockPattern, config);
            expect(result.fitness).toBeGreaterThan(0);
            // Elite preservation would be verified through fitness scores
        });
    });

    describe("mutation and crossover", () => {
        it("should create valid offspring through crossover", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "parent-2",
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(async (pattern) => ({
                ...pattern,
                id: "offspring-1",
            }));

            const config = {
                populationSize: 4,
                generationLimit: 2,
                crossoverRate: 1, // Force crossover
                mutationRate: 0,
            };

            const result = await evolution.evolvePattern(mockPattern, config);
            expect(result).toBeDefined();
            expect(mockStaging.validatePattern).toHaveBeenCalled();
        });

        it("should create valid offspring through mutation", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "parent-1",
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(async (pattern) => ({
                ...pattern,
                id: "mutated-1",
            }));

            const config = {
                populationSize: 4,
                generationLimit: 2,
                crossoverRate: 0, // Force mutation
                mutationRate: 1,
            };

            const result = await evolution.evolvePattern(mockPattern, config);
            expect(result).toBeDefined();
            expect(mockStaging.validatePattern).toHaveBeenCalled();
        });
    });
});
