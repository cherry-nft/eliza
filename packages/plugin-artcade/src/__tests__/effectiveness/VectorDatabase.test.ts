import { VectorDatabase } from "../../services/VectorDatabase";
import { ClaudeUsageContext } from "../../types/effectiveness";
import { DatabaseTestHelper } from "../helpers/DatabaseTestHelper";
import { v4 as uuidv4 } from "uuid";

describe("VectorDatabase - Pattern Effectiveness", () => {
    let vectorDb: VectorDatabase;
    let dbHelper: DatabaseTestHelper;
    const testPatternId = uuidv4();

    beforeEach(async () => {
        dbHelper = new DatabaseTestHelper();
        vectorDb = new VectorDatabase();
        await vectorDb.initialize(dbHelper.getMockRuntime());

        // Insert test pattern
        await dbHelper.insertTestPattern({
            id: testPatternId,
            type: "interaction",
            pattern_name: "test_pattern",
            effectiveness_score: 0.5,
            usage_count: 0,
        });
    });

    afterEach(async () => {
        await dbHelper.cleanup();
    });

    describe("trackClaudeUsage", () => {
        it("should track Claude's usage of patterns", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create an interactive game with smooth animations",
                generated_html: "<div class='game'>Test</div>",
                similarity_score: 0.85,
                matched_patterns: [
                    {
                        pattern_id: testPatternId,
                        similarity: 0.85,
                        features_used: ["animation", "interactivity"],
                    },
                ],
                quality_assessment: {
                    visual_score: 0.9,
                    interactive_score: 0.8,
                    functional_score: 0.7,
                    performance_score: 0.85,
                },
            };

            await vectorDb.trackClaudeUsage(context);

            // Verify pattern_effectiveness entry
            const effectivenessResult = await dbHelper.query(
                "SELECT * FROM pattern_effectiveness WHERE pattern_id = $1",
                [testPatternId]
            );
            expect(effectivenessResult.rows).toHaveLength(1);
            expect(effectivenessResult.rows[0].embedding_similarity).toBe(0.85);
            expect(effectivenessResult.rows[0].prompt_keywords).toContain(
                "interactive"
            );
            expect(effectivenessResult.rows[0].prompt_keywords).toContain(
                "animations"
            );

            // Verify pattern metrics update
            const patternResult = await dbHelper.query(
                "SELECT * FROM game_patterns WHERE id = $1",
                [testPatternId]
            );
            expect(patternResult.rows[0].usage_count).toBe(1);
            expect(patternResult.rows[0].effectiveness_score).toBeGreaterThan(
                0.5
            );
            expect(patternResult.rows[0].claude_usage_metrics).toBeTruthy();
        });

        it("should handle multiple pattern matches", async () => {
            const secondPatternId = uuidv4();
            await dbHelper.insertTestPattern({
                id: secondPatternId,
                type: "animation",
                pattern_name: "test_pattern_2",
                effectiveness_score: 0.6,
                usage_count: 0,
            });

            const context: ClaudeUsageContext = {
                prompt: "Create a game with animations and interactions",
                generated_html: "<div class='game'>Test</div>",
                similarity_score: 0.8,
                matched_patterns: [
                    {
                        pattern_id: testPatternId,
                        similarity: 0.8,
                        features_used: ["interactivity"],
                    },
                    {
                        pattern_id: secondPatternId,
                        similarity: 0.75,
                        features_used: ["animation"],
                    },
                ],
                quality_assessment: {
                    visual_score: 0.85,
                    interactive_score: 0.75,
                    functional_score: 0.8,
                    performance_score: 0.9,
                },
            };

            await vectorDb.trackClaudeUsage(context);

            const effectivenessResults = await dbHelper.query(
                "SELECT * FROM pattern_effectiveness"
            );
            expect(effectivenessResults.rows).toHaveLength(2);
        });

        it("should update effectiveness scores correctly", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create a high-performance interactive game",
                generated_html: "<div class='game'>Test</div>",
                similarity_score: 0.95,
                matched_patterns: [
                    {
                        pattern_id: testPatternId,
                        similarity: 0.95,
                        features_used: ["interactivity", "performance"],
                    },
                ],
                quality_assessment: {
                    visual_score: 1.0,
                    interactive_score: 1.0,
                    functional_score: 1.0,
                    performance_score: 1.0,
                },
            };

            await vectorDb.trackClaudeUsage(context);

            const result = await dbHelper.query(
                "SELECT effectiveness_score FROM game_patterns WHERE id = $1",
                [testPatternId]
            );
            expect(result.rows[0].effectiveness_score).toBe(1.0);
        });

        it("should extract keywords correctly from prompt", async () => {
            const context: ClaudeUsageContext = {
                prompt: "Create an interactive 3D game with particle effects",
                generated_html: "<div class='game'>Test</div>",
                similarity_score: 0.8,
                matched_patterns: [
                    {
                        pattern_id: testPatternId,
                        similarity: 0.8,
                        features_used: ["3d", "particles"],
                    },
                ],
                quality_assessment: {
                    visual_score: 0.9,
                    interactive_score: 0.8,
                    functional_score: 0.7,
                    performance_score: 0.85,
                },
            };

            await vectorDb.trackClaudeUsage(context);

            const result = await dbHelper.query(
                "SELECT prompt_keywords FROM pattern_effectiveness WHERE pattern_id = $1",
                [testPatternId]
            );
            expect(result.rows[0].prompt_keywords).toContain("interactive");
            expect(result.rows[0].prompt_keywords).toContain("particle");
            expect(result.rows[0].prompt_keywords).toContain("effects");
        });
    });
});
