import { describe, it, expect, beforeEach, vi } from "vitest";
import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import {
    PatternStagingService,
    GamePattern,
    PatternService,
} from "../services/PatternStaging";

describe("PatternStagingService", () => {
    let stagingService: PatternStagingService;
    let mockRuntime: IAgentRuntime & { logger: typeof elizaLogger };
    let mockPatternService: PatternService;

    beforeEach(() => {
        mockPatternService = {
            storeApprovedPattern: vi.fn().mockResolvedValue(undefined),
            initialize: vi.fn().mockResolvedValue(undefined),
        } as unknown as PatternService;

        mockRuntime = {
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            },
            getService: vi.fn().mockImplementation((name: string) => {
                if (name === "PatternService") return mockPatternService;
                return undefined;
            }),
        } as unknown as IAgentRuntime & { logger: typeof elizaLogger };

        stagingService = new PatternStagingService();
        stagingService.initialize(mockRuntime);
    });

    const mockPattern: Partial<GamePattern> = {
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
    };

    const mockLocation = {
        file: "test.html",
        start_line: 1,
        end_line: 10,
    };

    describe("stagePattern", () => {
        it("should stage a pattern and return an ID", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            expect(stagingId).toBeDefined();
            expect(typeof stagingId).toBe("string");

            const stagedPattern =
                await stagingService.getStagedPattern(stagingId);
            expect(stagedPattern).toBeDefined();
            expect(stagedPattern?.type).toBe(mockPattern.type);
            expect(stagedPattern?.pending_approval).toBe(true);
            expect(stagedPattern?.effectiveness_score).toBe(0);
            expect(stagedPattern?.usage_count).toBe(0);
            expect(stagedPattern?.location).toEqual(mockLocation);
        });

        it("should log debug information when staging", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            expect(mockRuntime.logger.debug).toHaveBeenCalledWith(
                `Pattern staged: ${stagingId}`,
                expect.objectContaining({
                    type: mockPattern.type,
                    location: mockLocation,
                })
            );
        });

        it("should handle multiple pattern types", async () => {
            const layoutPattern: Partial<GamePattern> = {
                type: "layout",
                pattern_name: "test_layout",
                content: {
                    html: "<div class='container'>Layout Test</div>",
                    css: ".container { display: flex; }",
                    context: "layout",
                    metadata: {
                        visual_type: "container",
                    },
                },
            };

            const stylePattern: Partial<GamePattern> = {
                type: "style",
                pattern_name: "test_style",
                content: {
                    html: "<div class='styled'>Style Test</div>",
                    css: ".styled { background: linear-gradient(#fff, #000); }",
                    context: "style",
                    metadata: {
                        visual_type: "gradient",
                    },
                },
            };

            const stagingId1 = await stagingService.stagePattern(
                layoutPattern,
                "test_evolution",
                mockLocation
            );
            const stagingId2 = await stagingService.stagePattern(
                stylePattern,
                "test_evolution",
                mockLocation
            );

            const pattern1 = await stagingService.getStagedPattern(stagingId1);
            const pattern2 = await stagingService.getStagedPattern(stagingId2);

            expect(pattern1?.type).toBe("layout");
            expect(pattern2?.type).toBe("style");
        });

        it("should preserve JavaScript content when staging", async () => {
            const interactionPattern: Partial<GamePattern> = {
                type: "interaction",
                pattern_name: "test_interaction",
                content: {
                    html: "<button class='interactive'>Click Me</button>",
                    js: "document.querySelector('.interactive').addEventListener('click', () => {})",
                    context: "interaction",
                    metadata: {
                        interaction_type: "click",
                    },
                },
            };

            const stagingId = await stagingService.stagePattern(
                interactionPattern,
                "test_evolution",
                mockLocation
            );

            const pattern = await stagingService.getStagedPattern(stagingId);
            expect(pattern?.content.js).toBeDefined();
            expect(pattern?.content.js).toContain("addEventListener");
        });

        it("should handle patterns with dependencies", async () => {
            const patternWithDeps: Partial<GamePattern> = {
                type: "animation",
                pattern_name: "test_animation_deps",
                content: {
                    html: "<div class='animated'>Test</div>",
                    css: "@keyframes test { }",
                    context: "animation",
                    metadata: {
                        visual_type: "animation",
                        dependencies: ["gsap", "anime.js"],
                    },
                },
            };

            const stagingId = await stagingService.stagePattern(
                patternWithDeps,
                "test_evolution",
                mockLocation
            );

            const pattern = await stagingService.getStagedPattern(stagingId);
            expect(pattern?.content.metadata.dependencies).toEqual([
                "gsap",
                "anime.js",
            ]);
        });
    });

    describe("approvePattern", () => {
        it("should approve a staged pattern", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            const approvalMetadata = {
                reason: "Good animation pattern",
                quality_notes: "Smooth transitions",
            };

            await stagingService.approvePattern(stagingId, approvalMetadata);

            // Pattern should be removed from staging
            const pattern = await stagingService.getStagedPattern(stagingId);
            expect(pattern).toBeNull();

            // Should have called pattern service to store
            expect(mockRuntime.getService).toHaveBeenCalledWith(
                "PatternService"
            );
            expect(
                mockPatternService.storeApprovedPattern
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockPattern,
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            approval: expect.objectContaining({
                                ...approvalMetadata,
                                approved_at: expect.any(Date),
                            }),
                        }),
                    }),
                })
            );
        });

        it("should throw error for non-existent pattern", async () => {
            await expect(
                stagingService.approvePattern("non-existent", {
                    reason: "test",
                })
            ).rejects.toThrowError("Pattern non-existent not found in staging");
        });

        it("should throw error if PatternService is not available", async () => {
            vi.mocked(mockRuntime.getService).mockReturnValue(undefined);

            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            await expect(
                stagingService.approvePattern(stagingId, {
                    reason: "test",
                })
            ).rejects.toThrowError("PatternService not found");
        });

        it("should handle approval with inspiration source", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            const approvalMetadata = {
                reason: "Good animation pattern",
                quality_notes: "Smooth transitions",
                inspiration_source: "spinwheel-test2.html",
            };

            await stagingService.approvePattern(stagingId, approvalMetadata);

            expect(
                mockPatternService.storeApprovedPattern
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            approval: expect.objectContaining({
                                inspiration_source: "spinwheel-test2.html",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should preserve all pattern data when approving", async () => {
            const complexPattern: Partial<GamePattern> = {
                type: "animation",
                pattern_name: "complex_animation",
                content: {
                    html: "<div class='complex'>Test</div>",
                    css: "@keyframes complex { }",
                    js: "console.log('animation started')",
                    context: "animation",
                    metadata: {
                        visual_type: "animation",
                        animation_duration: "2s",
                        color_scheme: ["#ff0000", "#00ff00"],
                        dependencies: ["gsap"],
                    },
                },
            };

            const stagingId = await stagingService.stagePattern(
                complexPattern,
                "test_evolution",
                mockLocation
            );

            await stagingService.approvePattern(stagingId, {
                reason: "Complex pattern test",
            });

            expect(
                mockPatternService.storeApprovedPattern
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        html: complexPattern.content.html,
                        css: complexPattern.content.css,
                        js: complexPattern.content.js,
                        metadata: expect.objectContaining({
                            visual_type: "animation",
                            animation_duration: "2s",
                            color_scheme: ["#ff0000", "#00ff00"],
                            dependencies: ["gsap"],
                        }),
                    }),
                })
            );
        });
    });

    describe("rejectPattern", () => {
        it("should remove a pattern from staging", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            await stagingService.rejectPattern(stagingId);
            const pattern = await stagingService.getStagedPattern(stagingId);
            expect(pattern).toBeNull();
            expect(mockRuntime.logger.debug).toHaveBeenCalledWith(
                `Pattern ${stagingId} rejected`
            );
        });

        it("should throw error for non-existent pattern", async () => {
            await expect(
                stagingService.rejectPattern("non-existent")
            ).rejects.toThrowError("Pattern non-existent not found in staging");
        });
    });

    describe("listStagedPatterns", () => {
        it("should list all staged patterns", async () => {
            const id1 = await stagingService.stagePattern(
                mockPattern,
                "test_evolution_1",
                mockLocation
            );
            const id2 = await stagingService.stagePattern(
                mockPattern,
                "test_evolution_2",
                mockLocation
            );

            const patterns = await stagingService.listStagedPatterns();
            expect(patterns).toHaveLength(2);
            expect(patterns.map((p) => p.id)).toContain(id1);
            expect(patterns.map((p) => p.id)).toContain(id2);
        });

        it("should return empty array when no patterns are staged", async () => {
            const patterns = await stagingService.listStagedPatterns();
            expect(patterns).toHaveLength(0);
        });

        it("should handle patterns of different types", async () => {
            await stagingService.stagePattern(
                { ...mockPattern, type: "animation" },
                "test_evolution_1",
                mockLocation
            );
            await stagingService.stagePattern(
                { ...mockPattern, type: "layout" },
                "test_evolution_2",
                mockLocation
            );
            await stagingService.stagePattern(
                { ...mockPattern, type: "style" },
                "test_evolution_3",
                mockLocation
            );

            const patterns = await stagingService.listStagedPatterns();
            const types = patterns.map((p) => p.pattern.type);
            expect(types).toContain("animation");
            expect(types).toContain("layout");
            expect(types).toContain("style");
        });

        it("should maintain pattern order", async () => {
            const ids = [];
            for (let i = 0; i < 5; i++) {
                const id = await stagingService.stagePattern(
                    mockPattern,
                    `test_evolution_${i}`,
                    mockLocation
                );
                ids.push(id);
            }

            const patterns = await stagingService.listStagedPatterns();
            expect(patterns.map((p) => p.id)).toEqual(ids);
        });
    });

    describe("clearStaging", () => {
        it("should clear all staged patterns", async () => {
            await stagingService.stagePattern(
                mockPattern,
                "test_evolution_1",
                mockLocation
            );
            await stagingService.stagePattern(
                mockPattern,
                "test_evolution_2",
                mockLocation
            );

            await stagingService.clearStaging();
            const patterns = await stagingService.listStagedPatterns();
            expect(patterns).toHaveLength(0);
            expect(mockRuntime.logger.debug).toHaveBeenCalledWith(
                "Pattern staging cleared"
            );
        });
    });

    describe("Pattern History", () => {
        it("should track pattern creation history", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            const history = await stagingService.getPatternHistory(stagingId);
            expect(history).toHaveLength(1);
            expect(history[0].action).toBe("created");
            expect(history[0].metadata.source_file).toBe(mockLocation.file);
            expect(history[0].metadata.line_range).toEqual({
                start: mockLocation.start_line,
                end: mockLocation.end_line,
            });
        });

        it("should track pattern approval history", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            const approvalMetadata = {
                reason: "Good pattern",
                approver: "test_user",
                quality_notes: "High quality implementation",
            };

            await stagingService.approvePattern(stagingId, approvalMetadata);

            const history = await stagingService.getPatternHistory(stagingId);
            expect(history).toHaveLength(2);
            expect(history[1].action).toBe("approved");
            expect(history[1].metadata.approver).toBe("test_user");
            expect(history[1].metadata.reason).toBe("Good pattern");
        });

        it("should track pattern rejection history", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            await stagingService.rejectPattern(
                stagingId,
                "Low quality implementation"
            );

            const history = await stagingService.getPatternHistory(stagingId);
            expect(history).toHaveLength(2);
            expect(history[1].action).toBe("rejected");
            expect(history[1].metadata.reason).toBe(
                "Low quality implementation"
            );
        });

        it("should maintain chronological order in history", async () => {
            const stagingId = await stagingService.stagePattern(
                mockPattern,
                "test_evolution",
                mockLocation
            );

            // Add some delay between actions
            await new Promise((resolve) => setTimeout(resolve, 10));
            await stagingService.rejectPattern(stagingId, "First rejection");
            await new Promise((resolve) => setTimeout(resolve, 10));

            const history = await stagingService.getPatternHistory(stagingId);
            expect(history).toHaveLength(2);
            expect(history[0].timestamp.getTime()).toBeLessThan(
                history[1].timestamp.getTime()
            );
        });

        it("should handle missing history gracefully", async () => {
            const history =
                await stagingService.getPatternHistory("non-existent");
            expect(history).toEqual([]);
        });
    });
});
