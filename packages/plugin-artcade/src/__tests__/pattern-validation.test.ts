import {
    isValidPatternType,
    isValidSemanticTags,
    isValidPatternMetadata,
    isValidGamePattern,
    validateGamePattern,
} from "../utils/pattern-validation";
import { GamePattern } from "../types/patterns";

describe("Pattern Validation", () => {
    describe("isValidPatternType", () => {
        it("should validate correct pattern types", () => {
            expect(isValidPatternType("animation")).toBe(true);
            expect(isValidPatternType("layout")).toBe(true);
            expect(isValidPatternType("interaction")).toBe(true);
            expect(isValidPatternType("style")).toBe(true);
            expect(isValidPatternType("game_mechanic")).toBe(true);
        });

        it("should reject invalid pattern types", () => {
            expect(isValidPatternType("invalid")).toBe(false);
            expect(isValidPatternType("")).toBe(false);
        });
    });

    describe("isValidSemanticTags", () => {
        it("should validate correct semantic tags", () => {
            const validTags = {
                use_cases: ["animation", "visual_feedback"],
                mechanics: ["collision", "physics"],
                interactions: ["mouse", "touch"],
                visual_style: ["animated", "keyframe_animation"],
            };
            expect(isValidSemanticTags(validTags)).toBe(true);
        });

        it("should reject invalid semantic tags", () => {
            const invalidTags = {
                use_cases: ["animation"],
                mechanics: [123], // Invalid type
                interactions: ["mouse"],
                visual_style: ["animated"],
            };
            expect(isValidSemanticTags(invalidTags)).toBe(false);
        });

        it("should reject missing required arrays", () => {
            const incompleteTags = {
                use_cases: ["animation"],
                mechanics: ["collision"],
                // Missing interactions and visual_style
            };
            expect(isValidSemanticTags(incompleteTags)).toBe(false);
        });
    });

    describe("isValidPatternMetadata", () => {
        it("should validate correct metadata", () => {
            const validMetadata = {
                description: "Test pattern",
                visual_type: "animation",
                interaction_type: "user_input",
                color_scheme: ["#ff0000", "#00ff00"],
                animation_duration: "1s",
                dependencies: ["jquery"],
                game_mechanics: [
                    {
                        type: "collision",
                        properties: { uses_bounding_box: true },
                    },
                ],
                semantic_tags: {
                    use_cases: ["animation"],
                    mechanics: ["collision"],
                    interactions: ["mouse"],
                    visual_style: ["animated"],
                },
            };
            expect(isValidPatternMetadata(validMetadata)).toBe(true);
        });

        it("should validate metadata with optional fields missing", () => {
            const minimalMetadata = {
                semantic_tags: {
                    use_cases: [],
                    mechanics: [],
                    interactions: [],
                    visual_style: [],
                },
            };
            expect(isValidPatternMetadata(minimalMetadata)).toBe(true);
        });

        it("should reject invalid metadata", () => {
            const invalidMetadata = {
                visual_type: 123, // Should be string
                color_scheme: ["invalid"], // Should be hex colors
                game_mechanics: [{ type: "collision" }], // Missing properties
            };
            expect(isValidPatternMetadata(invalidMetadata)).toBe(false);
        });
    });

    describe("isValidGamePattern", () => {
        const validPattern: GamePattern = {
            id: "test-id",
            type: "animation",
            pattern_name: "test-pattern",
            content: {
                html: "<div>Test</div>",
                context: "test",
                metadata: {
                    semantic_tags: {
                        use_cases: [],
                        mechanics: [],
                        interactions: [],
                        visual_style: [],
                    },
                },
            },
            effectiveness_score: 1.0,
            usage_count: 0,
            room_id: "room-1",
            user_id: "user-1",
            agent_id: "agent-1",
            created_at: new Date(),
            last_used: new Date(),
            usage_stats: {
                total_uses: 0,
                successful_uses: 0,
                average_similarity: 0,
                last_used: new Date(),
            },
            claude_usage_metrics: {
                last_usage: {
                    direct_reuse: false,
                    structural_similarity: 0,
                    feature_adoption: [],
                    timestamp: new Date(),
                },
            },
        };

        it("should validate correct pattern", () => {
            expect(isValidGamePattern(validPattern)).toBe(true);
        });

        it("should reject pattern with missing required fields", () => {
            const invalidPattern = { ...validPattern };
            delete (invalidPattern as any).id;
            expect(isValidGamePattern(invalidPattern)).toBe(false);
        });

        it("should reject pattern with invalid field types", () => {
            const invalidPattern = {
                ...validPattern,
                effectiveness_score: "1.0", // Should be number
            };
            expect(isValidGamePattern(invalidPattern)).toBe(false);
        });
    });

    describe("validateGamePattern", () => {
        const validPattern: GamePattern = {
            id: "test-id",
            type: "animation",
            pattern_name: "test-pattern",
            content: {
                html: "<div>Test</div>",
                context: "test",
                metadata: {
                    semantic_tags: {
                        use_cases: [],
                        mechanics: [],
                        interactions: [],
                        visual_style: [],
                    },
                },
            },
            effectiveness_score: 1.0,
            usage_count: 0,
            room_id: "room-1",
            user_id: "user-1",
            agent_id: "agent-1",
            created_at: new Date(),
            last_used: new Date(),
            usage_stats: {
                total_uses: 0,
                successful_uses: 0,
                average_similarity: 0,
                last_used: new Date(),
            },
            claude_usage_metrics: {
                last_usage: {
                    direct_reuse: false,
                    structural_similarity: 0,
                    feature_adoption: [],
                    timestamp: new Date(),
                },
            },
        };

        it("should return no errors for valid pattern", () => {
            const errors = validateGamePattern(validPattern);
            expect(errors).toHaveLength(0);
        });

        it("should return errors for missing required fields", () => {
            const invalidPattern = { ...validPattern };
            delete (invalidPattern as any).id;
            delete (invalidPattern as any).type;

            const errors = validateGamePattern(invalidPattern);
            expect(errors).toContain("Pattern ID is required");
            expect(errors).toContain("Pattern type is required");
        });

        it("should return errors for invalid field types", () => {
            const invalidPattern = {
                ...validPattern,
                effectiveness_score: "1.0", // Should be number
                usage_count: "0", // Should be number
            };

            const errors = validateGamePattern(invalidPattern);
            expect(errors).toContain("Effectiveness score must be a number");
            expect(errors).toContain("Usage count must be a number");
        });

        it("should return errors for invalid metadata", () => {
            const invalidPattern = {
                ...validPattern,
                content: {
                    ...validPattern.content,
                    metadata: {
                        semantic_tags: {
                            use_cases: [123], // Should be strings
                            mechanics: [],
                            interactions: [],
                            visual_style: [],
                        },
                    },
                },
            };

            const errors = validateGamePattern(invalidPattern);
            expect(errors).toContain("Invalid pattern metadata structure");
        });
    });
});
