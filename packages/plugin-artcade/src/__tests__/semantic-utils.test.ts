import {
    extractSemanticTags,
    encodeSemanticRoomId,
    parseSemanticRoomId,
    calculateSemanticBoost,
} from "../utils/semantic-utils";
import { GamePattern, SemanticTags } from "../types/patterns";

describe("Semantic Utils", () => {
    const mockGamePattern: GamePattern = {
        id: "123",
        type: "game_mechanic",
        pattern_name: "Advanced Vehicle Movement System",
        content: {
            html: '<div class="game"></div>',
            js: `
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowUp') moveForward();
                });
            `,
            css: ".game { }",
            context: "A racing game with physics-based vehicle controls",
            metadata: {
                interaction_type: "keyboard",
                visual_type: "top_down",
                game_mechanics: [
                    { type: "physics", properties: {} },
                    { type: "movement", properties: {} },
                ],
            },
        },
        embedding: [],
        effectiveness_score: 1,
        usage_count: 0,
        room_id: "",
        user_id: "",
        agent_id: "",
    };

    describe("extractSemanticTags", () => {
        it("should extract tags from pattern name", () => {
            const tags = extractSemanticTags(mockGamePattern);
            expect(tags.mechanics).toContain("movement");
            expect(tags.mechanics).toContain("vehicle_control");
        });

        it("should extract tags from context", () => {
            const tags = extractSemanticTags(mockGamePattern);
            expect(tags.use_cases).toContain("racing_game");
            expect(tags.mechanics).toContain("physics");
        });

        it("should extract tags from metadata", () => {
            const tags = extractSemanticTags(mockGamePattern);
            expect(tags.interactions).toContain("keyboard");
            expect(tags.visual_style).toContain("top_down");
        });

        it("should extract tags from JS content", () => {
            const tags = extractSemanticTags(mockGamePattern);
            expect(tags.interactions).toContain("keyboard_control");
        });

        it("should deduplicate tags", () => {
            const tags = extractSemanticTags(mockGamePattern);
            const uniqueTags = new Set(tags.mechanics);
            expect(tags.mechanics.length).toBe(uniqueTags.size);
        });
    });

    describe("encodeSemanticRoomId", () => {
        it("should encode tags into UUID format", () => {
            const tags: SemanticTags = {
                use_cases: ["racing"],
                mechanics: ["physics"],
                interactions: ["keyboard"],
                visual_style: ["top_down"],
            };
            const roomId = encodeSemanticRoomId(tags);
            expect(roomId).toMatch(/^[a-z0-9-]{36}$/);
            expect(roomId.split("-").length).toBe(5);
        });

        it("should handle empty tags", () => {
            const tags: SemanticTags = {
                use_cases: [],
                mechanics: [],
                interactions: [],
                visual_style: [],
            };
            const roomId = encodeSemanticRoomId(tags);
            expect(roomId).toBe("00000000-0000-0000-0000-000000000000");
        });
    });

    describe("parseSemanticRoomId", () => {
        it("should parse encoded room_id back to tags", () => {
            const originalTags: SemanticTags = {
                use_cases: ["racing"],
                mechanics: ["physics"],
                interactions: ["keyboard"],
                visual_style: ["top_down"],
            };
            const roomId = encodeSemanticRoomId(originalTags);
            const parsedTags = parseSemanticRoomId(roomId);

            expect(parsedTags.use_cases).toContain("racing");
            expect(parsedTags.mechanics).toContain("physics");
            expect(parsedTags.interactions).toContain("keyboard");
            expect(parsedTags.visual_style).toContain("top_down");
        });

        it("should handle empty segments", () => {
            const roomId = "00000000-0000-0000-0000-000000000000";
            const tags = parseSemanticRoomId(roomId);
            expect(tags.use_cases).toHaveLength(0);
            expect(tags.mechanics).toHaveLength(0);
            expect(tags.interactions).toHaveLength(0);
            expect(tags.visual_style).toHaveLength(0);
        });
    });

    describe("calculateSemanticBoost", () => {
        it("should calculate boost based on matching tags", () => {
            const patternTags: SemanticTags = {
                use_cases: ["racing", "driving"],
                mechanics: ["physics", "movement"],
                interactions: ["keyboard"],
                visual_style: ["top_down"],
            };
            const queryTags: SemanticTags = {
                use_cases: ["racing"],
                mechanics: ["physics"],
                interactions: ["keyboard"],
                visual_style: ["top_down"],
            };

            const boost = calculateSemanticBoost(patternTags, queryTags);
            expect(boost).toBeGreaterThan(0);
            expect(boost).toBeLessThanOrEqual(1);
        });

        it("should return 0 boost for no matches", () => {
            const patternTags: SemanticTags = {
                use_cases: ["racing"],
                mechanics: ["physics"],
                interactions: ["keyboard"],
                visual_style: ["top_down"],
            };
            const queryTags: SemanticTags = {
                use_cases: ["puzzle"],
                mechanics: ["match3"],
                interactions: ["mouse"],
                visual_style: ["2d"],
            };

            const boost = calculateSemanticBoost(patternTags, queryTags);
            expect(boost).toBe(0);
        });
    });
});
