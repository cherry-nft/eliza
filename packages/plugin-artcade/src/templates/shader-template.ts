import { GamePattern } from "../services/PatternStaging";

export const SHADER_TEMPLATE: Partial<GamePattern> = {
    type: "shader",
    pattern_name: "webgl_shader_template",
    content: {
        html: `
<!-- WebGL Shader Template with Real-time Controls -->
<canvas id="shaderCanvas"></canvas>
<button id="toggleMenu">Customize Shader</button>
<button id="randomizeButton">Randomize Shader</button>
<div id="customizeMenu">
    <h3>Shader Customization</h3>
    <!-- Dynamic Controls Section -->
    <div id="controls"></div>
</div>

<script id="vertexShader" type="x-shader/x-vertex">
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
</script>

<script id="fragmentShader" type="x-shader/x-fragment">
    precision highp float;
    // Standard uniforms
    uniform vec2 uResolution;
    uniform float uTime;
    // Customizable uniforms
    uniform float uIterations;
    uniform float uColorShift;
    uniform float uZoom;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform float uMirrors;

    // Color palette function
    vec3 palette(float t) {
        vec3 a = uColor1;
        vec3 b = uColor2;
        vec3 c = uColor3;
        vec3 d = uColor4;
        return a + b*cos( 6.28318*(c*t+d) );
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
        uv *= uZoom;

        // Mirror effect
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float sector = 6.28318 / uMirrors;
        angle = mod(angle, sector);
        if (mod(floor(atan(uv.y, uv.x) / sector), 2.0) == 1.0) {
            angle = sector - angle;
        }
        uv = vec2(cos(angle), sin(angle)) * radius;

        vec2 uv0 = uv;
        vec3 finalColor = vec3(0.0);

        for (float i = 0.0; i < 10.0; i++) {
            if (i >= uIterations) break;
            uv = fract(uv * 1.5) - 0.5;

            float d = length(uv) * exp(-length(uv0));
            vec3 col = palette(length(uv0) + i*uColorShift + uTime*0.4);
            d = sin(d*8. + uTime)/8.;
            d = abs(d);
            d = pow(0.01 / d, 1.2);
            finalColor += col * d;
        }

        gl_FragColor = vec4(finalColor, 1.0);
    }
</script>`,
        js: `
// WebGL initialization and rendering
function initShader() {
    const canvas = document.getElementById('shaderCanvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }
    return gl;
}

function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Shader parameters and controls
const shaderParams = {
    speed: { min: 0, max: 2, step: 0.1, default: 1, label: 'Animation Speed' },
    iterations: { min: 1, max: 10, step: 1, default: 4, label: 'Iterations' },
    colorShift: { min: 0, max: 1, step: 0.1, default: 0.4, label: 'Color Shift' },
    zoom: { min: 0.5, max: 2, step: 0.1, default: 1, label: 'Zoom' },
    mirrors: { min: 2, max: 32, step: 1, default: 4, label: 'Number of Mirrors' },
    colors: [
        { id: 'color1', label: 'Color 1', default: '#808080' },
        { id: 'color2', label: 'Color 2', default: '#808080' },
        { id: 'color3', label: 'Color 3', default: '#FFFFFF' },
        { id: 'color4', label: 'Color 4', default: '#436A8E' }
    ]
};

// Dynamic controls generation
function generateControls() {
    const controlsDiv = document.getElementById('controls');
    Object.entries(shaderParams).forEach(([key, param]) => {
        if (Array.isArray(param)) {
            // Color controls
            param.forEach(color => {
                const div = document.createElement('div');
                div.className = 'color-picker';
                div.innerHTML = \`
                    <input type="color" id="\${color.id}" value="\${color.default}">
                    <label for="\${color.id}">\${color.label}</label>
                \`;
                controlsDiv.appendChild(div);
            });
        } else {
            // Slider controls
            const div = document.createElement('div');
            div.innerHTML = \`
                <label for="\${key}">\${param.label}:</label>
                <input type="range" id="\${key}"
                    min="\${param.min}" max="\${param.max}"
                    step="\${param.step}" value="\${param.default}">
            \`;
            controlsDiv.appendChild(div);
        }
    });
}

// Color conversion utilities
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (Math.round(r * 255) << 16) +
        (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
}

// Main initialization
function initializeShaderApp() {
    const gl = initShader();
    if (!gl) return;

    generateControls();
    setupEventListeners();
    startRenderLoop(gl);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeShaderApp);`,
        css: `
body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: Arial, sans-serif;
}
canvas {
    width: 100%;
    height: 100%;
    display: block;
}
#customizeMenu {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 20px;
    border-radius: 10px;
    display: none;
    max-height: 80vh;
    overflow-y: auto;
}
#toggleMenu, #randomizeButton {
    position: absolute;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 10px;
    cursor: pointer;
    border-radius: 5px;
}
#toggleMenu {
    top: 10px;
    right: 10px;
}
#randomizeButton {
    bottom: 10px;
    left: 10px;
}
input[type="range"] {
    width: 100%;
    margin: 10px 0;
}
label {
    display: block;
    margin-top: 10px;
}
.color-picker {
    display: flex;
    align-items: center;
    margin-top: 10px;
}
.color-picker input[type="color"] {
    margin-right: 10px;
}`,
        context: "shader",
        metadata: {
            visual_type: "webgl_shader",
            interaction_type: "real_time_customization",
            color_scheme: ["#808080", "#808080", "#FFFFFF", "#436A8E"],
            animation_duration: "continuous",
            dependencies: [
                {
                    name: "gl-matrix",
                    version: "2.8.1",
                    source: "cdnjs",
                    url: "https://cdnjs.cloudflare.com/ajax/libs/gl-matrix/2.8.1/gl-matrix-min.js",
                    required: true,
                },
            ],
            shader_specific: {
                vertex_shader: "minimal_passthrough",
                fragment_shader: "complex_mirror_fractal",
                uniforms: [
                    "resolution",
                    "time",
                    "iterations",
                    "colorShift",
                    "zoom",
                    "mirrors",
                    "color1",
                    "color2",
                    "color3",
                    "color4",
                ],
                customization_points: [
                    "animation_speed",
                    "iteration_count",
                    "color_palette",
                    "zoom_level",
                    "mirror_count",
                ],
                performance_notes:
                    "Optimized for real-time rendering with dynamic parameter updates",
            },
        },
    },
    effectiveness_score: 0.97,
    usage_count: 0,
};

// Helper function to create a new shader instance
export function createShaderPattern(customizations = {}): Partial<GamePattern> {
    return {
        ...SHADER_TEMPLATE,
        pattern_name: `webgl_shader_${Date.now()}`,
        content: {
            ...SHADER_TEMPLATE.content,
            metadata: {
                ...SHADER_TEMPLATE.content?.metadata,
                ...customizations,
            },
        },
    };
}
