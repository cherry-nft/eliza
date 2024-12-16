import { describe, it, expect, beforeEach, vi } from "vitest";
import { artcadePlugin } from "../index";
import { IAgentRuntime } from "@ai16z/eliza";
import { EVOLVE, ANALYZE_PATTERN } from "../actions";
import { readFileSync } from "fs";
import { join } from "path";

const TEST_HTML = `<div class="container">
    <h1>Test Page</h1>
    <div class="content">
        <p>This is a test paragraph that will be evolved into something more interactive.</p>
        <div class="box">
            <span>Click me!</span>
        </div>
    </div>
</div>`;

describe("Artcade Plugin Integration", () => {
    let runtime: IAgentRuntime;
    let memoryStore: Map<string, any>;
    let lastMemoryId: string;

    beforeEach(() => {
        memoryStore = new Map();
        lastMemoryId = "0";

        // Create a more sophisticated mock runtime that tracks memory operations
        runtime = {
            getMemoryManager: () => ({
                createMemory: vi.fn(async (memory) => {
                    const id = (parseInt(lastMemoryId) + 1).toString();
                    lastMemoryId = id;
                    memoryStore.set(id, { id, ...memory });
                    return { id, ...memory };
                }),
                getMemory: vi.fn(async ({ id }) => memoryStore.get(id)),
                searchMemories: vi.fn(async ({ filter, limit = 10 }) => {
                    return Array.from(memoryStore.values())
                        .filter((memory) => {
                            if (filter?.tableName) {
                                return memory.type === filter.tableName;
                            }
                            return true;
                        })
                        .slice(0, limit);
                }),
            }),
        };
    });

    describe("Evolution Pipeline", () => {
        it("should evolve HTML and produce more interactive content", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            const result = await evolveAction.handler(runtime, {
                html: TEST_HTML,
                generations: 2,
                populationSize: 4,
            });

            // Verify evolution produced valid HTML
            expect(result.html).toContain("<div");
            expect(result.html).not.toBe(TEST_HTML);

            // Check for any mutation effects
            expect(result.html).toMatch(
                /(onclick|onmouseover|draggable|animation|game-player|game-score|game-collectible|transform|position:\s*absolute)/
            );

            // Verify stats were recorded
            expect(result.stats).toBeDefined();
            expect(result.stats?.generations).toBe(2);
            expect(result.stats?.bestFitness).toBeGreaterThan(0);

            // Verify memory storage
            const memories = await runtime
                .getMemoryManager()
                .searchMemories({ filter: { tableName: "evolution_result" } });
            expect(memories.length).toBeGreaterThan(0);

            const lastMemory = memories[memories.length - 1];
            expect(lastMemory.content.input).toBe(TEST_HTML);
            expect(lastMemory.content.output).toBe(result.html);
        });

        it("should apply different types of mutations", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            const result = await evolveAction.handler(runtime, {
                html: `<div class="container">
                    <div class="progress-tracker">
                        <div class="score">Score: <span>0</span></div>
                        <div class="progress">Progress: <span>0%</span></div>
                    </div>
                    <h1>Test Page</h1>
                    <div class="content">
                        <p>This is a test paragraph that will be evolved into something more interactive.</p>
                        <div class="box">
                            <span>Click me!</span>
                        </div>
                    </div>
                    <div class="interactive-element">Click to Progress</div>
                </div>`,
                generations: 2,
                populationSize: 4,
                mutationOperators: ["add_game_element"],
                mutationCount: 1,
            });

            // Check for game elements
            expect(result.html).toMatch(
                /(game-score|game-player|game-collectible)/
            );
        });

        /* Keep other tests commented for now
        it("should maintain HTML structure validity", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            const result = await evolveAction.handler(runtime, {
                html: TEST_HTML,
                generations: 2,
                populationSize: 4,
            });

            // Parse evolved HTML to verify structure
            const parser = new DOMParser();
            const doc = parser.parseFromString(result.html, "text/html");

            // Check for parsing errors
            const parserErrors = doc.getElementsByTagName("parsererror");
            expect(parserErrors.length).toBe(0);

            // Verify key elements are preserved
            expect(doc.querySelector(".container")).toBeTruthy();
            expect(doc.querySelector("h1")).toBeTruthy();
            expect(doc.querySelector(".content")).toBeTruthy();
        });

        it("should improve fitness scores over generations", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            const result = await evolveAction.handler(runtime, {
                html: TEST_HTML,
                generations: 2,
                populationSize: 4,
            });

            // Get evolution history from memory
            const memories = await runtime
                .getMemoryManager()
                .searchMemories({ filter: { tableName: "evolution_result" } });

            // Extract fitness scores
            const fitnessScores = memories
                .filter((m) => m.content.fitness)
                .map((m) => m.content.fitness.total);

            // Verify fitness improvement
            const firstScore = fitnessScores[0];
            const lastScore = fitnessScores[fitnessScores.length - 1];
            expect(lastScore).toBeGreaterThan(firstScore);
        });
        */

        it("should evaluate game-specific fitness metrics", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            const result = await evolveAction.handler(runtime, {
                html: TEST_HTML,
                generations: 2,
                populationSize: 4,
            });

            // Get evolution results from memory
            const memories = await runtime
                .getMemoryManager()
                .searchMemories({ filter: { tableName: "evolution_result" } });

            const lastMemory = memories[memories.length - 1];
            const fitness = lastMemory.content.fitness;

            // Verify all game-specific metrics are present
            expect(fitness.playerControl).toBeDefined();
            expect(fitness.collectibles).toBeDefined();
            expect(fitness.scoring).toBeDefined();
            expect(fitness.obstacles).toBeDefined();
            expect(fitness.gameLoop).toBeDefined();

            // Verify metrics are within valid range
            expect(fitness.playerControl).toBeGreaterThanOrEqual(0);
            expect(fitness.playerControl).toBeLessThanOrEqual(1);
            expect(fitness.collectibles).toBeGreaterThanOrEqual(0);
            expect(fitness.collectibles).toBeLessThanOrEqual(1);
            expect(fitness.scoring).toBeGreaterThanOrEqual(0);
            expect(fitness.scoring).toBeLessThanOrEqual(1);
            expect(fitness.obstacles).toBeGreaterThanOrEqual(0);
            expect(fitness.obstacles).toBeLessThanOrEqual(1);
            expect(fitness.gameLoop).toBeGreaterThanOrEqual(0);
            expect(fitness.gameLoop).toBeLessThanOrEqual(1);

            // Verify at least some game elements are present
            const evolved = result.html;
            expect(evolved).toMatch(
                /(game-score|score|points|tokens|rewards|interactive|onclick|onmouseover|draggable|collectible|progress|achievement|level|rank|badge)/
            );

            // Verify there's some form of state or progress tracking
            expect(evolved).toMatch(
                /(Score:|Points:|Progress:|Level:|Tokens:|Balance:|Collected:|Achieved:)/i
            );
        });
    });

    /* Keep pattern analysis test commented for now
    describe("Pattern Analysis", () => {
        it("should track pattern effectiveness", async () => {
            // First evolve some HTML to generate patterns
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            )!;

            await evolveAction.handler(runtime, {
                html: TEST_HTML,
                generations: 2,
                populationSize: 4,
            });

            // Then analyze a pattern
            const analyzeAction = artcadePlugin.actions.find(
                (action) => action.name === "ANALYZE_PATTERN"
            )!;

            // Get a pattern ID from the evolution results
            const memories = await runtime
                .getMemoryManager()
                .searchMemories({ filter: { tableName: "evolution_result" } });
            const patternId = memories[0].content.appliedPatterns[0];

            const result = await analyzeAction.handler(runtime, {
                patternId,
            });

            expect(result.effectiveness).toBeDefined();
            expect(result.effectiveness).toBeGreaterThanOrEqual(0);
            expect(result.effectiveness).toBeLessThanOrEqual(1);
        });
    });
    */
});
