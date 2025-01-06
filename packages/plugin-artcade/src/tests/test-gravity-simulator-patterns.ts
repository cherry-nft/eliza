import { PatternData } from "./test-insert-example";

export const gravitySimulatorPatterns = [
    {
        type: "layout",
        pattern_name: "gravity-simulator-layout",
        content: {
            html: `<canvas id="pulsarCanvas"></canvas>
<button id="fullscreenButton">Full Screen</button>
<button id="customizationToggle">Customize</button>

<div id="customizationMenu">
  <h2>Customize Particles</h2>
  <label for="colorMode">Color Mode:</label>
  <select id="colorMode">
    <option value="multi">Multicolored</option>
    <option value="single">Single Color</option>
  </select>
  <label for="particleColor">Particle Color:</label>
  <input type="color" id="particleColor" value="#ffffff" style="display: none;">
  <label for="particleSize">Particle Size:</label>
  <input type="range" id="particleSize" min="0.5" max="5" step="0.1" value="1.5">
  <span id="particleSizeValue">1.5</span>
  <label for="particleAmount">Particle Amount:</label>
  <input type="range" id="particleAmount" min="100" max="3800" step="100" value="1200">
  <span id="particleAmountValue">1200</span>
</div>`,
            css: `body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: #000000;
    font-family: Arial, sans-serif;
}

canvas {
    display: block;
}

#fullscreenButton, #customizationToggle {
    position: absolute;
    top: 10px;
    background-color: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.3s;
}

#fullscreenButton {
    right: 10px;
}

#customizationToggle {
    left: 10px;
}

#fullscreenButton:hover, #customizationToggle:hover {
    background-color: rgba(255,255,255,0.3);
}

#customizationMenu {
    position: absolute;
    top: 50px;
    left: 10px;
    background-color: rgba(0,0,0,0.7);
    padding: 15px;
    border-radius: 10px;
    color: white;
    display: none;
    transition: opacity 0.3s ease-in-out;
    opacity: 0;
}

#customizationMenu.visible {
    display: block;
    opacity: 1;
}

#customizationMenu h2 {
    margin-top: 0;
    font-size: 18px;
}

#customizationMenu label {
    display: block;
    margin-top: 10px;
}

#customizationMenu input[type="color"],
#customizationMenu input[type="range"] {
    width: 100%;
    margin-top: 5px;
}

#colorModeSelect {
    width: 100%;
    margin-top: 5px;
    background-color: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 5px;
}`,
            context:
                "A full-viewport canvas layout with customization controls for particle simulation",
            metadata: {
                type: "game_layout",
                theme: "dark",
                colors: {
                    background: "#000000",
                    ui: "rgba(255,255,255,0.2)",
                    text: "#ffffff",
                },
                components: ["canvas", "controls", "customization_menu"],
                canvas_size: {
                    width: "100vw",
                    height: "100vh",
                },
            },
        },
        room_id:
            "dark_theme-fullscreen_canvas-floating_controls-customization_panel",
    },
    {
        type: "game_mechanic",
        pattern_name: "particle-gravity-physics",
        content: {
            js: `const G = 6.67430e-11; // Gravitational constant
const SCALE_FACTOR = 1e9; // Scale factor to make gravity more noticeable
const MAX_SPEED = 8;
const DECELERATION_FACTOR = 0.98;

function Particle(x, y) {
    this.x = x;
    this.y = y;
    this.radius = particleSize;
    this.mass = Math.random() * 0.9 + 0.1; // Mass between 0.1 and 1
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.color = colorMode === "single" ? particleColor : getRandomColor();
}

Particle.prototype.update = function() {
    let totalForceX = 0;
    let totalForceY = 0;
    let isAffectedByGravity = false;

    const wellArray = Array.from(gravityWells.values());

    for (let i = 0; i < wellArray.length; i++) {
        const well = wellArray[i];
        const dx = well.x - this.x;
        const dy = well.y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared);

        // Calculate gravitational force
        const force = (G * this.mass * well.mass) / distanceSquared * SCALE_FACTOR;

        totalForceX += (dx / distance) * force;
        totalForceY += (dy / distance) * force;

        // Realistic orbital velocity calculation
        const orbitalSpeed = Math.sqrt((G * well.mass) / distance) * SCALE_FACTOR;
        const tangentX = -dy / distance;
        const tangentY = dx / distance;

        this.vx += tangentX * orbitalSpeed * 0.01;
        this.vy += tangentY * orbitalSpeed * 0.01;

        isAffectedByGravity = true;
    }

    // Particle-particle interactions
    for (let i = 0; i < particles.length; i += 10) {
        if (this === particles[i]) continue;
        const dx = particles[i].x - this.x;
        const dy = particles[i].y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 100) {
            const distance = Math.sqrt(distanceSquared);
            const force = (G * this.mass * particles[i].mass) / distanceSquared * SCALE_FACTOR * 0.1;
            totalForceX += (dx / distance) * force;
            totalForceY += (dy / distance) * force;
            isAffectedByGravity = true;
        }
    }

    // Apply forces
    const ax = totalForceX / this.mass;
    const ay = totalForceY / this.mass;
    this.vx += ax;
    this.vy += ay;

    // Apply speed limit
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_SPEED) {
        const ratio = MAX_SPEED / speed;
        this.vx *= ratio;
        this.vy *= ratio;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Apply deceleration
    if (!isAffectedByGravity) {
        this.vx *= DECELERATION_FACTOR;
        this.vy *= DECELERATION_FACTOR;
    }

    // Boundary checks
    const effectiveRadius = this.radius * Math.sqrt(this.mass);
    if (this.x < effectiveRadius) {
        this.x = effectiveRadius;
        this.vx = Math.abs(this.vx) * 0.8;
    } else if (this.x > width - effectiveRadius) {
        this.x = width - effectiveRadius;
        this.vx = -Math.abs(this.vx) * 0.8;
    }

    if (this.y < effectiveRadius) {
        this.y = effectiveRadius;
        this.vy = Math.abs(this.vy) * 0.8;
    } else if (this.y > height - effectiveRadius) {
        this.y = height - effectiveRadius;
        this.vy = -Math.abs(this.vy) * 0.8;
    }
};`,
            context:
                "Physics system for particle gravity simulation with realistic forces and collisions",
            metadata: {
                type: "game_physics",
                features: [
                    "gravity_simulation",
                    "particle_interaction",
                    "collision_detection",
                    "physics_simulation",
                ],
                physics_properties: [
                    "mass",
                    "velocity",
                    "force",
                    "orbital_mechanics",
                ],
                collision_types: ["boundary_collision", "particle_interaction"],
            },
        },
        room_id:
            "physics_simulation-gravity-particle_interaction-collision_detection",
    },
    {
        type: "animation",
        pattern_name: "gravity-well-visualization",
        content: {
            js: `function drawParticle() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * Math.sqrt(this.mass), 0, Math.PI * 2);
    ctx.fill();
}

function drawGravityWells() {
    const wellArray = Array.from(gravityWells.values());
    for (let i = 0; i < wellArray.length; i++) {
        const well = wellArray[i];
        const gradientRadius = 75 * Math.sqrt(well.mass / 1e6);
        const gradient = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, gradientRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(well.x, well.y, gradientRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(well.x, well.y, 5 * Math.sqrt(well.mass / 1e6), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();

        // Draw connections between gravity wells
        for (let j = i + 1; j < wellArray.length; j++) {
            const otherWell = wellArray[j];
            const dx = otherWell.x - well.x;
            const dy = otherWell.y - well.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 150) {
                ctx.beginPath();
                ctx.moveTo(well.x, well.y);
                ctx.lineTo(otherWell.x, otherWell.y);
                ctx.strokeStyle = \`rgba(255, 255, 255, \${0.5 * (1 - distance / 150)})\`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}

function drawPulses() {
    pulses.forEach((pulse, index) => {
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.strokeStyle = \`rgba(255, 255, 255, \${1 - pulse.radius / pulse.maxRadius})\`;
        ctx.lineWidth = 3;
        ctx.stroke();

        pulse.radius += pulse.speed;
        if (pulse.radius > pulse.maxRadius) {
            pulses.splice(index, 1);
        }
    });
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, width, height);

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    drawGravityWells();
    drawPulses();

    requestAnimationFrame(animate);
}`,
            context:
                "Visual effects system for gravity wells, particles, and pulse animations",
            metadata: {
                type: "visual_effect",
                effect_type: "particle_system",
                features: [
                    "gradient_effects",
                    "pulse_animations",
                    "particle_trails",
                    "force_visualization",
                ],
                animation_properties: [
                    "opacity",
                    "size",
                    "color",
                    "trail_effect",
                ],
                visual_elements: [
                    "gravity_wells",
                    "particles",
                    "pulses",
                    "connections",
                ],
            },
        },
        room_id:
            "visual_effects-particle_system-gravity_visualization-pulse_animation",
    },
    {
        type: "interaction",
        pattern_name: "gravity-well-controls",
        content: {
            js: `function handleStart(event) {
    event.preventDefault();
    const touches = event.changedTouches || [{ identifier: 'mouse', clientX: event.clientX, clientY: event.clientY }];
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        gravityWells.set(touch.identifier, {
            x: touch.clientX,
            y: touch.clientY,
            mass: 1e6,
            strength: 3000
        });
    }
}

function handleMove(event) {
    event.preventDefault();
    const touches = event.changedTouches || [{ identifier: 'mouse', clientX: event.clientX, clientY: event.clientY }];
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        if (gravityWells.has(touch.identifier)) {
            const well = gravityWells.get(touch.identifier);
            well.x = touch.clientX;
            well.y = touch.clientY;
        }
    }
}

function handleEnd(event) {
    event.preventDefault();
    const touches = event.changedTouches || [{ identifier: 'mouse' }];
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        if (gravityWells.has(touch.identifier)) {
            const well = gravityWells.get(touch.identifier);
            pulses.push({
                x: well.x,
                y: well.y,
                radius: 0,
                maxRadius: Math.max(width, height) / 2,
                speed: 10,
                strength: 100
            });
            gravityWells.delete(touch.identifier);
        }
    }
}

function setupControls() {
    canvas.addEventListener('touchstart', handleStart, false);
    canvas.addEventListener('touchmove', handleMove, false);
    canvas.addEventListener('touchend', handleEnd, false);

    canvas.addEventListener('mousedown', handleStart, false);
    canvas.addEventListener('mousemove', (event) => {
        if (gravityWells.has('mouse')) {
            handleMove(event);
        }
    }, false);
    canvas.addEventListener('mouseup', handleEnd, false);

    const customizationMenu = document.getElementById('customizationMenu');
    const customizationToggle = document.getElementById('customizationToggle');
    const colorModeSelect = document.getElementById('colorMode');
    const particleColorInput = document.getElementById('particleColor');
    const particleSizeInput = document.getElementById('particleSize');
    const particleSizeValue = document.getElementById('particleSizeValue');
    const particleAmountInput = document.getElementById('particleAmount');
    const particleAmountValue = document.getElementById('particleAmountValue');

    customizationToggle.addEventListener('click', () => {
        customizationMenu.classList.toggle('visible');
        customizationToggle.textContent = customizationMenu.classList.contains('visible') ? 'Hide Customize' : 'Customize';
    });

    colorModeSelect.addEventListener('change', (event) => {
        colorMode = event.target.value;
        if (colorMode === "single") {
            particleColorInput.style.display = "block";
        } else {
            particleColorInput.style.display = "none";
        }
        createInitialParticles();
    });

    particleColorInput.addEventListener('input', (event) => {
        particleColor = event.target.value;
        if (colorMode === "single") {
            createInitialParticles();
        }
    });

    particleSizeInput.addEventListener('input', (event) => {
        particleSize = parseFloat(event.target.value);
        particleSizeValue.textContent = particleSize.toFixed(1);
        createInitialParticles();
    });

    particleAmountInput.addEventListener('input', (event) => {
        MAX_PARTICLES = parseInt(event.target.value);
        particleAmountValue.textContent = MAX_PARTICLES;
        createInitialParticles();
    });
}`,
            context:
                "Input handling system for mouse/touch interactions and UI controls",
            metadata: {
                type: "input_handler",
                input_types: ["mouse", "touch"],
                features: [
                    "gravity_well_creation",
                    "well_movement",
                    "pulse_generation",
                    "customization_controls",
                ],
                interaction_modes: [
                    "click_and_drag",
                    "multi_touch",
                    "ui_controls",
                ],
            },
        },
        room_id:
            "input_handling-gravity_controls-touch_support-customization_ui",
    },
];

export type { PatternData };
