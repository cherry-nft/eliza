import { describe, it, expect, beforeEach, vi } from "vitest";
import { PatternService } from "../services/PatternService";
import { SHADER_TEMPLATE } from "../templates/shader-template";
import { VectorSupabase } from "../services/VectorSupabase";

// Mock VectorSupabase
vi.mock("../services/VectorSupabase", () => {
    return {
        VectorSupabase: vi.fn().mockImplementation(() => ({
            findSimilarPatterns: vi.fn(),
            storePattern: vi.fn(),
            trackClaudeUsage: vi.fn(),
            healthCheck: vi.fn().mockResolvedValue(true),
        })),
    };
});

describe("PatternService", () => {
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

    beforeEach(() => {
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
    });

    let service: PatternService;

    beforeEach(() => {
        service = new PatternService();
    });

    describe("Shader Pattern Handling", () => {
        it("should have shader template registered", async () => {
            const template = await service.getTemplate("shader");
            expect(template).toBeDefined();
            expect(template?.type).toBe("shader");
        });

        it("should create shader pattern from template", async () => {
            const pattern = await service.createFromTemplate("shader", {
                visual_type: "custom_visual",
                color_scheme: ["#FF0000", "#00FF00"],
            });

            expect(pattern).toBeDefined();
            expect(pattern?.type).toBe("shader");
            expect(pattern?.content.metadata.visual_type).toBe("custom_visual");
            expect(pattern?.content.metadata.color_scheme).toEqual([
                "#FF0000",
                "#00FF00",
            ]);
            expect(pattern?.content.html).toContain("shaderCanvas");
            expect(pattern?.content.js).toBeDefined();
            expect(pattern?.content.css).toBeDefined();
        });

        it("should store and retrieve shader patterns", async () => {
            const pattern = await service.createFromTemplate("shader");
            if (!pattern) throw new Error("Failed to create pattern");

            await service.storePattern(pattern);
            const retrieved = await service.getPattern(pattern.id);

            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(pattern.id);
            expect(retrieved?.type).toBe("shader");
        });

        it("should update shader pattern properties", async () => {
            const pattern = await service.createFromTemplate("shader");
            if (!pattern) throw new Error("Failed to create pattern");

            await service.storePattern(pattern);
            await service.updatePattern(pattern.id, {
                content: {
                    metadata: {
                        visual_type: "updated_visual",
                        shader_specific: {
                            uniforms: [
                                "newUniform",
                                ...(pattern.content.metadata.shader_specific
                                    ?.uniforms || []),
                            ],
                        },
                    },
                },
            });

            const updated = await service.getPattern(pattern.id);
            expect(updated?.content.metadata.visual_type).toBe(
                "updated_visual"
            );
            expect(
                updated?.content.metadata.shader_specific?.uniforms
            ).toContain("newUniform");
        });

        it("should find all shader patterns", async () => {
            const service = new PatternService();
            await service.initialize(mockRuntime);

            // Create a test shader pattern
            await service.createFromTemplate("shader", {
                name: "test-shader",
                uniforms: {
                    time: { type: "float", default: 0.0 },
                },
            });

            const shaderPatterns = await service.findPatternsByType("shader");
            expect(shaderPatterns).toHaveLength(1);
            expect(shaderPatterns[0].type).toBe("shader");
        });

        it("should maintain shader dependencies when creating from template", async () => {
            const pattern = await service.createFromTemplate("shader");
            expect(pattern?.content.metadata.dependencies).toBeDefined();
            expect(pattern?.content.metadata.dependencies?.[0].name).toBe(
                "gl-matrix"
            );
        });

        it("should preserve shader-specific metadata in template", async () => {
            const pattern = await service.createFromTemplate("shader");
            const shaderMeta = pattern?.content.metadata.shader_specific;

            expect(shaderMeta).toBeDefined();
            expect(shaderMeta?.vertex_shader).toBe("minimal_passthrough");
            expect(shaderMeta?.fragment_shader).toBe("complex_mirror_fractal");
            expect(shaderMeta?.customization_points).toContain(
                "animation_speed"
            );
        });
    });
});
