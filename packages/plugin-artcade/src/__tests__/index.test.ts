import { describe, it, expect } from "vitest";
import { artcadePlugin } from "../index";

describe("Artcade Plugin", () => {
    it("should register actions", () => {
        expect(artcadePlugin.actions).toHaveLength(2);
        expect(artcadePlugin.actions[0].name).toBe("EVOLVE");
        expect(artcadePlugin.actions[1].name).toBe("ANALYZE_PATTERN");
    });

    it("should have valid action handlers", () => {
        artcadePlugin.actions.forEach((action) => {
            expect(action.handler).toBeDefined();
            expect(action.validate).toBeDefined();
            expect(typeof action.description).toBe("string");
            expect(Array.isArray(action.similes)).toBe(true);
            expect(Array.isArray(action.examples)).toBe(true);
        });
    });
});
