import { describe, it, expect, beforeEach, vi } from "vitest";
import { PatternLibrary } from "../services/PatternLibrary";

describe("PatternLibrary", () => {
    let library: PatternLibrary;
    const mockRuntime = {
        logger: {
            info: vi.fn(),
            error: vi.fn(),
        },
        getService: vi.fn(),
    };

    const mockVectorDb = {
        findSimilarPatterns: vi.fn(),
        getPattern: vi.fn(),
        updatePattern: vi.fn(),
    };

    const mockStaging = {
        stagePattern: vi.fn(),
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        mockRuntime.getService.mockImplementation((name: string) => {
            switch (name) {
                case "VectorDatabase":
                    return mockVectorDb;
                case "PatternStaging":
                    return mockStaging;
                default:
                    return null;
            }
        });

        library = new PatternLibrary();
        await library.initialize(mockRuntime);
    });

    describe("pattern storage", () => {
        it("should store a new pattern", async () => {
            const pattern = {
                type: "game_mechanic" as const,
                pattern_name: "test_pattern",
                content: {
                    html: "<div>Test</div>",
                    context: "test",
                },
            };

            mockStaging.stagePattern.mockResolvedValueOnce("test-staging-id");

            const stagingId = await library.storePattern(pattern);
            expect(stagingId).toBe("test-staging-id");
            expect(mockStaging.stagePattern).toHaveBeenCalled();
            expect(mockRuntime.logger.info).toHaveBeenCalledWith(
                expect.stringContaining("test-staging-id")
            );
        });

        it("should throw error if not initialized", async () => {
            const library = new PatternLibrary();
            await expect(
                library.storePattern({
                    type: "game_mechanic",
                    content: { html: "", context: "" },
                })
            ).rejects.toThrow("PatternLibrary not initialized");
        });
    });

    describe("pattern search", () => {
        it("should find similar patterns", async () => {
            const pattern = {
                type: "game_mechanic" as const,
                embedding: [0.1, 0.2, 0.3],
            };

            const mockResults = [
                {
                    pattern: {
                        id: "test-1",
                        type: "game_mechanic",
                        effectiveness_score: 0.9,
                    },
                    similarity: 0.95,
                },
            ];

            mockVectorDb.findSimilarPatterns.mockResolvedValueOnce(mockResults);

            const results = await library.findSimilarPatterns(pattern);
            expect(results).toEqual(mockResults);
            expect(mockVectorDb.findSimilarPatterns).toHaveBeenCalledWith(
                pattern.embedding,
                "game_mechanic",
                0.85,
                5
            );
        });

        it("should throw error if pattern has no embedding", async () => {
            const pattern = {
                type: "game_mechanic" as const,
            };

            await expect(library.findSimilarPatterns(pattern)).rejects.toThrow(
                "Pattern must have an embedding"
            );
        });
    });

    describe("effectiveness scoring", () => {
        it("should update pattern effectiveness score", async () => {
            const patternId = "test-pattern";
            const currentScore = 0.8;
            const newScore = 0.9;

            mockVectorDb.getPattern.mockResolvedValueOnce({
                id: patternId,
                effectiveness_score: currentScore,
                usage_count: 5,
            });

            await library.updateEffectivenessScore(patternId, newScore);

            expect(mockVectorDb.updatePattern).toHaveBeenCalledWith(
                patternId,
                expect.objectContaining({
                    effectiveness_score: expect.any(Number),
                    usage_count: 6,
                    last_used: expect.any(Date),
                })
            );
        });

        it("should throw error if pattern not found", async () => {
            mockVectorDb.getPattern.mockResolvedValueOnce(null);

            await expect(
                library.updateEffectivenessScore("non-existent", 0.9)
            ).rejects.toThrow("Pattern non-existent not found");
        });
    });

    describe("game mechanics extraction", () => {
        it("should extract collision mechanics", async () => {
            const html = `
                <div class="game-player" data-collision="true" data-speed="5"></div>
                <script>
                    setInterval(() => {
                        const player = document.querySelector(".game-player");
                        // Collision logic
                    }, 16);
                </script>
            `;

            const patterns = await library.extractGameMechanics(html);
            const collisionPattern = patterns.find(
                (p) => p.pattern_name === "collision_detection"
            );
            expect(collisionPattern).toBeDefined();
            expect(collisionPattern?.type).toBe("game_mechanic");
            expect(
                collisionPattern?.content.metadata.game_mechanics?.[0].type
            ).toBe("collision");
        });

        it("should extract movement mechanics", async () => {
            const html = `
                <div class="game-player" data-speed="5"></div>
                <script>
                    document.addEventListener("keydown", (e) => {
                        // Movement logic
                    });
                </script>
            `;

            const patterns = await library.extractGameMechanics(html);
            const movementPattern = patterns.find(
                (p) => p.pattern_name === "movement_controls"
            );
            expect(movementPattern).toBeDefined();
            expect(movementPattern?.type).toBe("game_mechanic");
            expect(
                movementPattern?.content.metadata.game_mechanics?.[0].type
            ).toBe("movement");
        });

        it("should extract power-up mechanics", async () => {
            const html = `
                <div class="game-powerup speed" data-effect="speed" data-duration="5000"></div>
                <script>
                    function addPowerup(effect, duration) {
                        // Power-up logic
                    }
                    function removePowerup(effect) {
                        // Remove power-up
                    }
                </script>
            `;

            const patterns = await library.extractGameMechanics(html);
            const powerUpPattern = patterns.find(
                (p) => p.pattern_name === "power_up_system"
            );
            expect(powerUpPattern).toBeDefined();
            expect(powerUpPattern?.type).toBe("game_mechanic");
            expect(
                powerUpPattern?.content.metadata.game_mechanics?.[0].type
            ).toBe("power_up");
        });

        it("should extract multiple mechanics from complex HTML", async () => {
            const html = `
                <div class="game-player" data-collision="true" data-speed="5"></div>
                <div class="game-powerup speed" data-effect="speed" data-duration="5000"></div>
                <script>
                    setInterval(() => {
                        // Collision logic
                    }, 16);
                    document.addEventListener("keydown", (e) => {
                        // Movement logic
                    });
                    function addPowerup(effect, duration) {
                        // Power-up logic
                    }
                </script>
            `;

            const patterns = await library.extractGameMechanics(html);
            const types = patterns.map((p) => p.pattern_name).sort();
            expect(types).toEqual([
                "collision_detection",
                "movement_controls",
                "power_up_system",
            ]);
        });
    });

    describe("pattern extraction", () => {
        it("should extract animation patterns", async () => {
            const html = `
                <div style="animation: pulse 2s infinite;">
                    <style>
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                            100% { transform: scale(1); }
                        }
                    </style>
                </div>
            `;

            const patterns = await library.extractPatterns(html);
            const animationPattern = patterns.find(
                (p) => p.type === "animation"
            );
            expect(animationPattern).toBeDefined();
            expect(animationPattern?.content.css).toContain("@keyframes pulse");
            expect(animationPattern?.content.metadata.animation_duration).toBe(
                "2s"
            );
        });

        it("should extract layout patterns", async () => {
            const html = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr);">
                    <div style="display: flex; flex-direction: column;">
                        <span>Item 1</span>
                    </div>
                </div>
            `;

            const patterns = await library.extractPatterns(html);
            const layoutPattern = patterns.find((p) => p.type === "layout");
            expect(layoutPattern).toBeDefined();
            expect(layoutPattern?.content.html).toContain("display: grid");
            expect(layoutPattern?.content.html).toContain("display: flex");
        });

        it("should extract interaction patterns", async () => {
            const html = `
                <div onclick="handleClick()" onmouseover="handleHover()">
                    <div draggable="true">Drag me</div>
                </div>
            `;

            const patterns = await library.extractPatterns(html);
            const interactionPattern = patterns.find(
                (p) => p.type === "interaction"
            );
            expect(interactionPattern).toBeDefined();
            expect(interactionPattern?.content.html).toContain("onclick");
            expect(interactionPattern?.content.html).toContain("draggable");
            expect(interactionPattern?.content.metadata.interaction_type).toBe(
                "user_input"
            );
        });

        it("should extract style patterns", async () => {
            const html = `
                <div style="background-color: #ff0000; color: rgb(0, 255, 0);">
                    <span style="border: 1px solid rgba(0, 0, 255, 0.5);">Styled content</span>
                </div>
            `;

            const patterns = await library.extractPatterns(html);
            const stylePattern = patterns.find((p) => p.type === "style");
            expect(stylePattern).toBeDefined();
            expect(stylePattern?.content.html).toContain("background-color");
            expect(stylePattern?.content.metadata.color_scheme).toContain(
                "#ff0000"
            );
            expect(stylePattern?.content.metadata.color_scheme).toHaveLength(3);
        });

        it("should extract multiple pattern types from complex HTML", async () => {
            const html = `
                <div style="display: grid; animation: fade 1s;">
                    <div onclick="handleClick()" style="background-color: #123456;">
                        <style>
                            @keyframes fade {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                        </style>
                    </div>
                </div>
            `;

            const patterns = await library.extractPatterns(html);
            const types = patterns.map((p) => p.type);
            expect(types).toContain("animation");
            expect(types).toContain("layout");
            expect(types).toContain("interaction");
            expect(types).toContain("style");
        });
    });
});
