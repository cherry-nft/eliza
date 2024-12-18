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
            initialize: vi.fn(),
        } as unknown as jest.Mocked<VectorDatabase>;

        mockStaging = {
            validatePattern: vi.fn(),
            initialize: vi.fn(),
        } as unknown as jest.Mocked<PatternStaging>;

        mockRuntime = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
            },
            databaseAdapter: {
                query: vi.fn(),
            },
            embeddingCache: {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
            },
            vectorOperations: {
                initialize: vi.fn(),
            },
            getMemoryManager: vi.fn().mockReturnValue({
                initialize: vi.fn(),
                createMemory: vi.fn(),
                updateMemory: vi.fn(),
                getMemory: vi.fn(),
                getMemories: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
            }),
        } as unknown as IAgentRuntime & { logger: typeof elizaLogger };

        // Create and initialize evolution service
        evolution = new PatternEvolution();
        await evolution.initialize(mockRuntime);

        // Set dependencies
        evolution.staging = mockStaging;
        evolution.vectorDb = mockVectorDb;

        // Initialize dependencies
        await mockVectorDb.initialize(mockRuntime);
        await mockStaging.initialize(mockRuntime);

        console.log("Initializing PatternEvolution service");
        console.log("PatternEvolution service initialized");
    });

    describe("evolvePattern", () => {
        it("should evolve a pattern and return the best result", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.85,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player" onkeydown="handleMovement()"></div>
                                    <div class="power-up" data-effect="speed"></div>
                                    <script>
                                        function checkCollisions() {
                                            // Collision logic
                                        }
                                        setInterval(checkCollisions, 100);
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                fitnessThreshold: 0.8,
                populationSize: 4,
                generationLimit: 10,
                elitismCount: 1,
            });

            expect(result.fitness).toBeGreaterThanOrEqual(0.8);
            expect(result.generation).toBeLessThan(10);
            expect(mockStaging.validatePattern).toHaveBeenCalled();
        });

        it("should handle errors during evolution", async () => {
            mockVectorDb.findSimilarPatterns.mockRejectedValueOnce(
                new Error("Database error")
            );

            await expect(
                evolution.evolvePattern(mockPattern, {})
            ).rejects.toThrow();
        });

        it("should stop evolution when fitness threshold is reached", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.85,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player" onkeydown="handleMovement()"></div>
                                    <div class="power-up" data-effect="speed"></div>
                                    <script>
                                        let gameState = { score: 0, level: 1 };
                                        function checkCollisions() {
                                            // Collision logic
                                        }
                                        setInterval(checkCollisions, 100);
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.9,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                fitnessThreshold: 0.8,
                populationSize: 4,
                generationLimit: 10,
                elitismCount: 1,
            });

            expect(result.fitness).toBeGreaterThanOrEqual(0.8);
            expect(result.generation).toBeLessThan(10);
        });
    });

    describe("mutation and crossover", () => {
        it("should create valid offspring through crossover", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player"></div>
                                    <div class="power-up"></div>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
                elitismCount: 1,
            });

            expect(result).toBeDefined();
            expect(mockStaging.validatePattern).toHaveBeenCalled();
        });

        it("should create valid offspring through mutation", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player"></div>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
                elitismCount: 1,
            });

            expect(result).toBeDefined();
            expect(mockStaging.validatePattern).toHaveBeenCalled();
        });
    });

    describe("game mechanics", () => {
        it("should add game elements with collision detection", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player"></div>
                                    <script>
                                        setInterval(checkCollisions, 100);
                                        function checkCollisions() {
                                            // Collision detection
                                        }
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(
                /setInterval\(checkCollisions/
            );
            expect(result.pattern.content.html).toMatch(
                /function checkCollisions/
            );
        });

        it("should add player controls", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="player" onkeydown="handleMovement()"></div>
                                    <script>
                                        function handleMovement() {
                                            // Movement controls
                                        }
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(
                /left|right|up|down|move/i
            );
            expect(result.pattern.content.html).toMatch(/onkeydown/);
        });

        it("should add power-ups and game state management", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="power-up" data-effect="speed" data-duration="5000"></div>
                                    <script>
                                        let gameState = { powerUps: [] };
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(/data-effect="speed"/);
            expect(result.pattern.content.html).toMatch(/data-duration/);
        });

        it("should add level progression elements", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <div class="level-display">Level 1</div>
                                    <script>
                                        let gameState = { level: 1 };
                                        function levelUp() {
                                            gameState.level++;
                                        }
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(/level|stage|phase/i);
            expect(result.pattern.content.html).toMatch(/levelUp/);
        });

        it("should maintain game state across mutations", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <script>
                                        let gameState = {
                                            score: 0,
                                            level: 1,
                                            powerUps: []
                                        };
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(
                /gameState\s*=\s*{[^}]*score/
            );
        });

        it("should properly handle game events and collisions", async () => {
            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce([
                {
                    pattern: {
                        ...mockPattern,
                        id: "similar-1",
                        effectiveness_score: 0.7,
                        content: {
                            html: `
                                <div class="game-container">
                                    <script>
                                        function checkCollisions() {
                                            dispatchEvent(new CustomEvent('collision', {
                                                detail: { type: 'player-enemy' }
                                            }));
                                        }
                                        function gameOver() {
                                            dispatchEvent(new CustomEvent('gameOver', {
                                                detail: { score: gameState.score }
                                            }));
                                        }
                                    </script>
                                </div>
                            `,
                        },
                    },
                    similarity: 0.8,
                },
            ]);

            mockStaging.validatePattern.mockImplementation(
                async (pattern) => pattern
            );

            const result = await evolution.evolvePattern(mockPattern, {
                populationSize: 4,
                generationLimit: 3,
            });

            expect(result.pattern.content.html).toMatch(/checkCollisions\(\)/);
            expect(result.pattern.content.html).toMatch(/collision.*detail/);
            expect(result.pattern.content.html).toMatch(/gameOver.*detail/);
        });
    });
});
