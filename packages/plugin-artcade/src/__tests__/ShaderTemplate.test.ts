import { describe, it, expect } from "vitest";
import {
    SHADER_TEMPLATE,
    createShaderPattern,
} from "../templates/shader-template";

describe("Shader Template", () => {
    it("should have all required components", () => {
        expect(SHADER_TEMPLATE.type).toBe("shader");
        expect(SHADER_TEMPLATE.content?.html).toContain("shaderCanvas");
        expect(SHADER_TEMPLATE.content?.js).toBeDefined();
        expect(SHADER_TEMPLATE.content?.css).toBeDefined();
    });

    it("should have proper WebGL shader code", () => {
        const html = SHADER_TEMPLATE.content?.html || "";
        expect(html).toContain("vertexShader");
        expect(html).toContain("fragmentShader");
        expect(html).toContain("precision highp float");
        expect(html).toContain("uniform vec2 uResolution");
    });

    it("should have all required uniforms", () => {
        const metadata = SHADER_TEMPLATE.content?.metadata?.shader_specific;
        expect(metadata?.uniforms).toContain("resolution");
        expect(metadata?.uniforms).toContain("time");
        expect(metadata?.uniforms).toContain("iterations");
        expect(metadata?.uniforms).toContain("colorShift");
    });

    it("should have proper UI controls", () => {
        const html = SHADER_TEMPLATE.content?.html || "";
        expect(html).toContain("customizeMenu");
        expect(html).toContain("toggleMenu");
        expect(html).toContain("randomizeButton");
    });

    it("should have required dependencies", () => {
        const deps = SHADER_TEMPLATE.content?.metadata?.dependencies || [];
        expect(deps).toHaveLength(1);
        expect(deps[0].name).toBe("gl-matrix");
        expect(deps[0].version).toBe("2.8.1");
    });

    it("should create customized instances", () => {
        const customPattern = createShaderPattern({
            visual_type: "custom_shader",
            color_scheme: ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF"],
        });

        expect(customPattern.pattern_name).toContain("webgl_shader_");
        expect(customPattern.content?.metadata?.visual_type).toBe(
            "custom_shader"
        );
        expect(customPattern.content?.metadata?.color_scheme).toEqual([
            "#FF0000",
            "#00FF00",
            "#0000FF",
            "#FFFFFF",
        ]);
    });

    it("should maintain core functionality in customized instances", () => {
        const customPattern = createShaderPattern({});
        expect(customPattern.content?.html).toContain("shaderCanvas");
        expect(
            customPattern.content?.metadata?.shader_specific?.uniforms
        ).toBeDefined();
        expect(customPattern.content?.metadata?.dependencies?.[0].name).toBe(
            "gl-matrix"
        );
    });
});
