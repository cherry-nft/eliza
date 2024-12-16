import { describe, it, expect, beforeEach, vi } from "vitest";
import { artcadePlugin } from "../index";
import { IAgentRuntime } from "@ai16z/eliza";

// Create a mock runtime for testing
const createMockRuntime = (): IAgentRuntime => ({
    getMemoryManager: () => ({
        createMemory: vi.fn(),
        getMemory: vi.fn(),
        searchMemories: vi.fn(),
    }),
});

describe("Artcade Plugin", () => {
    let runtime: IAgentRuntime;

    beforeEach(() => {
        runtime = createMockRuntime();
    });

    describe("Plugin Structure", () => {
        it("should have correct plugin properties", () => {
            expect(artcadePlugin.name).toBe("artcade");
            expect(artcadePlugin.description).toBeDefined();
            expect(Array.isArray(artcadePlugin.actions)).toBe(true);
            expect(artcadePlugin.actions.length).toBe(2);
        });

        it("should have EVOLVE action", () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            );
            expect(evolveAction).toBeDefined();
            expect(evolveAction?.description).toBeDefined();
            expect(Array.isArray(evolveAction?.similes)).toBe(true);
            expect(Array.isArray(evolveAction?.examples)).toBe(true);
        });

        it("should have ANALYZE_PATTERN action", () => {
            const analyzeAction = artcadePlugin.actions.find(
                (action) => action.name === "ANALYZE_PATTERN"
            );
            expect(analyzeAction).toBeDefined();
            expect(analyzeAction?.description).toBeDefined();
            expect(Array.isArray(analyzeAction?.similes)).toBe(true);
            expect(Array.isArray(analyzeAction?.examples)).toBe(true);
        });
    });

    describe("EVOLVE Action", () => {
        it("should validate HTML input", async () => {
            const evolveAction = artcadePlugin.actions.find(
                (action) => action.name === "EVOLVE"
            );

            const validResult = await evolveAction?.validate?.(runtime, {
                html: "<div>Test</div>",
            });
            expect(validResult).toBe(true);

            const invalidResult = await evolveAction?.validate?.(runtime, {
                html: "",
            });
            expect(invalidResult).toBe(false);
        });
    });

    describe("ANALYZE_PATTERN Action", () => {
        it("should validate pattern ID", async () => {
            const analyzeAction = artcadePlugin.actions.find(
                (action) => action.name === "ANALYZE_PATTERN"
            );

            const validResult = await analyzeAction?.validate?.(runtime, {
                patternId: "test-pattern-1",
            });
            expect(validResult).toBe(true);

            const invalidResult = await analyzeAction?.validate?.(runtime, {
                patternId: "",
            });
            expect(invalidResult).toBe(false);
        });
    });
});
