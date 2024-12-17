import { describe, it, expect, beforeEach, vi } from "vitest";
import { PatternLearning } from "../services/PatternLearning";
import { PatternStagingService } from "../services/PatternStaging";

describe("PatternLearning", () => {
    let learning: PatternLearning;
    let mockRuntime: any;
    let mockStaging: any;

    beforeEach(() => {
        mockStaging = {
            stagePattern: vi.fn(),
            approvePattern: vi.fn(),
        };

        mockRuntime = {
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            },
            getService: vi.fn().mockImplementation((service) => {
                if (service === PatternStagingService) {
                    return mockStaging;
                }
                return null;
            }),
        };

        learning = new PatternLearning();
        learning.initialize(mockRuntime);
    });

    describe("Learning from HTML feedback", () => {
        it("should process HTML feedback and create a pattern", async () => {
            const feedback = {
                html: `<div class="game-element" style="animation: bounce 1s">
                    <button onclick="jump()">Jump</button>
                </div>`,
                sourceFile: "test.html",
                lineRange: { start: 1, end: 3 },
                feedback: {
                    visualAppeal: {
                        animationSmoothness: 9,
                        layoutBalance: 8,
                    },
                    gameplayElements: {
                        playerControls: 8,
                    },
                    naturalLanguageFeedback: "Great animation and controls",
                },
            };

            mockStaging.stagePattern.mockResolvedValueOnce("test-id");

            const stagingId = await learning.learnFromFeedback(feedback);

            expect(stagingId).toBe("test-id");
            expect(mockStaging.stagePattern).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "animation",
                    content: expect.objectContaining({
                        html: feedback.html,
                        metadata: expect.objectContaining({
                            visual_type: "animated",
                            interaction_type: "game_control",
                        }),
                    }),
                }),
                "user_feedback",
                {
                    file: feedback.sourceFile,
                    start_line: feedback.lineRange.start,
                    end_line: feedback.lineRange.end,
                }
            );
        });

        it("should auto-approve patterns with high effectiveness scores", async () => {
            const feedback = {
                html: `<div class="perfect-pattern">Test</div>`,
                sourceFile: "test.html",
                lineRange: { start: 1, end: 1 },
                feedback: {
                    visualAppeal: {
                        colorHarmony: 9,
                        layoutBalance: 9,
                        spacing: 9,
                        typography: 9,
                    },
                    naturalLanguageFeedback: "Perfect pattern",
                },
            };

            mockStaging.stagePattern.mockResolvedValueOnce("test-id");

            await learning.learnFromFeedback(feedback);

            expect(mockStaging.approvePattern).toHaveBeenCalledWith(
                "test-id",
                expect.objectContaining({
                    reason: expect.any(String),
                    quality_notes: feedback.feedback.naturalLanguageFeedback,
                })
            );
        });

        it("should detect pattern types correctly", async () => {
            const testCases = [
                {
                    html: `<div style="animation: test 1s">`,
                    expectedType: "animation",
                },
                {
                    html: `<button onclick="test()">`,
                    expectedType: "interaction",
                },
                {
                    html: `<div style="display: grid">`,
                    expectedType: "layout",
                },
                {
                    html: `<div style="color: red">`,
                    expectedType: "style",
                },
            ];

            for (const testCase of testCases) {
                const feedback = {
                    html: testCase.html,
                    sourceFile: "test.html",
                    lineRange: { start: 1, end: 1 },
                    feedback: {
                        naturalLanguageFeedback: "Test pattern",
                    },
                };

                mockStaging.stagePattern.mockResolvedValueOnce("test-id");

                await learning.learnFromFeedback(feedback);

                expect(mockStaging.stagePattern).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: testCase.expectedType,
                    }),
                    expect.any(String),
                    expect.any(Object)
                );
            }
        });

        it("should extract color schemes and animation durations", async () => {
            const feedback = {
                html: `<div style="color: #ff0000; background: rgb(0,255,0); animation: test 2.5s">`,
                sourceFile: "test.html",
                lineRange: { start: 1, end: 1 },
                feedback: {
                    naturalLanguageFeedback: "Test pattern",
                },
            };

            mockStaging.stagePattern.mockResolvedValueOnce("test-id");

            await learning.learnFromFeedback(feedback);

            expect(mockStaging.stagePattern).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            color_scheme: expect.arrayContaining([
                                "#ff0000",
                                "rgb(0,255,0)",
                            ]),
                            animation_duration: "2.5s",
                            visual_type: "static",
                            interaction_type: "passive",
                        }),
                    }),
                }),
                "user_feedback",
                {
                    file: feedback.sourceFile,
                    start_line: feedback.lineRange.start,
                    end_line: feedback.lineRange.end,
                }
            );
        });
    });
});
