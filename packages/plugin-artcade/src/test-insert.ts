import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const geometryRushPatterns = [
    {
        type: "game_mechanic",
        pattern_name: "Advanced Vehicle Movement System",
        content: {
            html: `
                <div class="game-container">
                    <div class="game-world">
                        <div class="player" id="player"></div>
                    </div>
                </div>
            `,
            js: `
                let playerX = 2000;
                let playerY = 2000;
                let playerAngle = 0;
                let playerSpeed = 6;
                let playerVelX = 0;
                let playerVelY = 0;
                const friction = 0.93;
                const turnSpeed = 4;
                const WORLD_WIDTH = 4000;
                const WORLD_HEIGHT = 4000;

                const keys = {
                    ArrowLeft: false,
                    ArrowRight: false,
                    ArrowUp: false,
                    ArrowDown: false
                };

                function updatePlayer() {
                    if (!gameIsOver) {
                        if (keys.ArrowLeft) playerAngle -= turnSpeed;
                        if (keys.ArrowRight) playerAngle += turnSpeed;

                        const angleRad = playerAngle * Math.PI / 180;

                        if (keys.ArrowUp) {
                            playerVelX += Math.cos(angleRad) * 0.4;
                            playerVelY += Math.sin(angleRad) * 0.4;
                        }
                        if (keys.ArrowDown) {
                            playerVelX -= Math.cos(angleRad) * 0.2;
                            playerVelY -= Math.sin(angleRad) * 0.2;
                        }

                        playerVelX *= friction;
                        playerVelY *= friction;

                        playerX += playerVelX;
                        playerY += playerVelY;

                        // Constrain player to world bounds
                        playerX = Math.max(15, Math.min(WORLD_WIDTH - 15, playerX));
                        playerY = Math.max(7.5, Math.min(WORLD_HEIGHT - 7.5, playerY));

                        // Update camera position
                        cameraX = Math.max(0, Math.min(WORLD_WIDTH - window.innerWidth, playerX - window.innerWidth / 2));
                        cameraY = Math.max(0, Math.min(WORLD_HEIGHT - window.innerHeight, playerY - window.innerHeight / 2));

                        // Apply camera transform to game world
                        document.querySelector('.game-world').style.transform = \`translate(\${-cameraX}px, \${-cameraY}px)\`;

                        // Update player position relative to camera
                        player.style.left = (playerX - 15) + 'px';
                        player.style.top = (playerY - 7.5) + 'px';
                        player.style.transform = \`rotate(\${playerAngle}deg)\`;

                        const speed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);
                        const driftIntensity = Math.abs(speed * (keys.ArrowLeft || keys.ArrowRight ? 1 : 0.5));
                        player.style.setProperty('--trail-width', \`\${driftIntensity * 20}px\`);

                        if (speed > 2) {
                            const trailCount = Math.ceil(speed / 2);
                            for (let i = 0; i < trailCount; i++) {
                                const trailX = playerX - (playerVelX * (i * 0.1));
                                const trailY = playerY - (playerVelY * (i * 0.1));
                                createTrail(trailX, trailY, playerAngle, driftIntensity * (10 - i));
                            }
                            player.classList.toggle('boosting', speed > 5);
                        }
                    }
                }

                document.addEventListener('keydown', (e) => {
                    if (keys.hasOwnProperty(e.key)) {
                        keys[e.key] = true;
                    }
                });

                document.addEventListener('keyup', (e) => {
                    if (keys.hasOwnProperty(e.key)) {
                        keys[e.key] = false;
                    }
                });
            `,
            css: `
                body {
                    margin: 0;
                    overflow: hidden;
                    background: #111;
                }

                .game-container {
                    position: fixed;
                    width: 100vw;
                    height: 100vh;
                    overflow: hidden;
                }

                .game-world {
                    position: absolute;
                    width: 4000px;
                    height: 4000px;
                    transform-origin: top left;
                    background: #111;
                    background-image: radial-gradient(rgba(50, 50, 50, 0.3) 2px, transparent 2px);
                    background-size: 50px 50px;
                }

                .player {
                    position: absolute;
                    width: 30px;
                    height: 15px;
                    background: var(--car-color, #0f0);
                    border-radius: 3px;
                    pointer-events: none;
                    transform-origin: center;
                    transition: transform 0.2s ease-out;
                }

                .player.boosting::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 20%;
                    width: 60%;
                    height: 100%;
                    background: var(--car-color, #0f0);
                    border-radius: 2px;
                    box-shadow: 0 0 15px var(--car-color, #0f0);
                }

                .player::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    width: 0;
                    height: 2px;
                    background: var(--trail-color-transparent, rgba(0, 255, 0, 0.3));
                    transform-origin: right;
                    pointer-events: none;
                    transition: width 0.1s;
                }

                .player::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 20%;
                    width: 60%;
                    height: 100%;
                    background: var(--car-color-dark, #0a0);
                    border-radius: 2px;
                }
            `,
            context:
                "Complete vehicle movement system with physics, camera tracking, and visual effects",
            metadata: {
                responsiveness: "high",
                smoothness: "high",
                complexity: "high",
                features: [
                    "momentum-based movement",
                    "drift mechanics",
                    "camera tracking",
                    "world bounds",
                    "visual feedback",
                    "speed boost effects",
                    "keyboard controls",
                ],
            },
        },
    },
    {
        type: "game_mechanic",
        pattern_name: "Intelligent Police AI System",
        content: {
            js: `
                function updateCops() {
                    const timestamp = Date.now();

                    cops.forEach(cop => {
                        const dx = playerX - cop.x;
                        const dy = playerY - cop.y;
                        const baseAngle = Math.atan2(dy, dx);

                        // Apply different movement patterns
                        let targetAngle = baseAngle;
                        let speedMultiplier = 1;

                        switch(cop.movementPattern) {
                            case 1: // Sine wave movement
                                const sineOffset = getSineWaveOffset(timestamp);
                                targetAngle += Math.sin(timestamp * 0.003) * 0.5;
                                break;

                            case 2: // Circular pursuit
                                const circularOffset = getCircularOffset(timestamp);
                                cop.x += circularOffset.x * 0.1;
                                cop.y += circularOffset.y * 0.1;
                                targetAngle += Math.sin(timestamp * 0.002) * 0.3;
                                speedMultiplier = 1.1;
                                break;

                            case 3: // Zigzag
                                if (timestamp - cop.lastZigzag > 1000) {
                                    cop.patternOffset = Math.random() * Math.PI/2 - Math.PI/4;
                                    cop.lastZigzag = timestamp;
                                }
                                targetAngle += cop.patternOffset;
                                speedMultiplier = 1.05;
                                break;
                        }

                        const angleDiff = targetAngle - cop.angle;
                        cop.angle += angleDiff * 0.1;

                        const targetVelX = Math.cos(targetAngle) * copSpeed * speedMultiplier;
                        const targetVelY = Math.sin(targetAngle) * copSpeed * speedMultiplier;

                        cop.velocity.x += (targetVelX - cop.velocity.x) * 0.08;
                        cop.velocity.y += (targetVelY - cop.velocity.y) * 0.08;

                        cop.x += cop.velocity.x;
                        cop.y += cop.velocity.y;

                        const driftAngle = cop.angle + Math.atan2(cop.velocity.y, cop.velocity.x) * 0.5;

                        cop.element.style.left = cop.x + 'px';
                        cop.element.style.top = cop.y + 'px';
                        cop.element.style.transform = \`rotate(\${driftAngle * 180 / Math.PI}deg)\`;
                    });
                }

                function createCop() {
                    const cop = document.createElement('div');
                    cop.className = 'cop';
                    const side = Math.floor(Math.random() * 4);
                    let x, y;

                    // Spawn relative to camera view
                    switch(side) {
                        case 0: x = cameraX + Math.random() * window.innerWidth; y = cameraY - 30; break;
                        case 1: x = cameraX + window.innerWidth + 30; y = cameraY + Math.random() * window.innerHeight; break;
                        case 2: x = cameraX + Math.random() * window.innerWidth; y = cameraY + window.innerHeight + 30; break;
                        case 3: x = cameraX - 30; y = cameraY + Math.random() * window.innerHeight; break;
                    }

                    cops.push({
                        element: cop,
                        x: x,
                        y: y,
                        angle: 0,
                        velocity: { x: 0, y: 0 },
                        targetAngle: 0,
                        movementPattern: Math.floor(Math.random() * 4),
                        patternOffset: 0,
                        lastZigzag: Date.now()
                    });
                }
            `,
            css: `
                .cop {
                    position: absolute;
                    width: 30px;
                    height: 30px;
                    background: #00f;
                    border-radius: 5px;
                    transform-origin: center;
                    transition: transform 0.3s ease-out;
                    animation: sirenFlash 1s infinite;
                    box-shadow: 0 0 15px rgba(0, 0, 255, 0.5);
                }

                @keyframes sirenFlash {
                    0% {
                        background: #00f;
                        box-shadow: 0 0 15px rgba(0, 0, 255, 0.5);
                    }
                    50% {
                        background: #f00;
                        box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
                    }
                    100% {
                        background: #00f;
                        box-shadow: 0 0 15px rgba(0, 0, 255, 0.5);
                    }
                }
            `,
            context:
                "Advanced AI system for police pursuit with multiple movement patterns and dynamic difficulty scaling",
            metadata: {
                intelligence: "high",
                variety: "high",
                difficulty_scaling: "dynamic",
                features: [
                    "multiple pursuit patterns",
                    "dynamic spawning",
                    "visual effects",
                    "difficulty progression",
                ],
            },
        },
    },
    {
        type: "style",
        pattern_name: "Dynamic Trail System",
        content: {
            js: `
                function createTrail(x, y, angle, width) {
                    const trail = document.createElement('div');
                    trail.className = 'player-trail';
                    trail.style.left = x + 'px';
                    trail.style.top = y + 'px';
                    trail.style.width = width + 'px';
                    trail.style.transform = \`rotate(\${angle}deg)\`;

                    const randomOffset = (Math.random() - 0.5) * 2;
                    trail.style.height = (3 + randomOffset) + 'px';
                    trail.style.opacity = 0.8 + (Math.random() * 0.2);

                    document.querySelector('.game-world').appendChild(trail);

                    requestAnimationFrame(() => {
                        trail.style.opacity = '0';
                        trail.style.width = (width * 0.7) + 'px';
                    });

                    setTimeout(() => {
                        document.querySelector('.game-world').removeChild(trail);
                    }, 1000);
                }

                // In updatePlayer:
                if (speed > 2) {
                    const trailCount = Math.ceil(speed / 2);
                    for (let i = 0; i < trailCount; i++) {
                        const trailX = playerX - (playerVelX * (i * 0.1));
                        const trailY = playerY - (playerVelY * (i * 0.1));
                        createTrail(trailX, trailY, playerAngle, driftIntensity * (10 - i));
                    }
                }
            `,
            css: `
                .player-trail {
                    position: absolute;
                    background: linear-gradient(90deg,
                        var(--trail-color-semi, rgba(0, 255, 0, 0.4)),
                        transparent
                    );
                    height: 3px;
                    pointer-events: none;
                    transform-origin: center;
                    border-radius: 1px;
                    opacity: 0.8;
                    transition: opacity 0.5s;
                }

                .player::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    width: 0;
                    height: 2px;
                    background: var(--trail-color-transparent, rgba(0, 255, 0, 0.3));
                    transform-origin: right;
                    pointer-events: none;
                    transition: width 0.1s;
                }
            `,
            context:
                "Dynamic trail system that responds to vehicle speed and movement",
            metadata: {
                performance: "high",
                visual_quality: "high",
                responsiveness: "high",
                features: [
                    "speed-based trails",
                    "fade effects",
                    "randomized variations",
                    "drift visualization",
                ],
            },
        },
    },
    {
        type: "animation",
        pattern_name: "Explosion and Impact Effects",
        content: {
            js: `
                function createExplosion(x, y, size = 1) {
                    const explosion = document.createElement('div');
                    explosion.className = 'explosion';
                    explosion.style.left = (x - 50) + 'px';
                    explosion.style.top = (y - 50) + 'px';

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('viewBox', '0 0 100 100');
                    svg.style.width = '100%';
                    svg.style.height = '100%';

                    const particles = 12;
                    for(let i = 0; i < particles; i++) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        const angle = (i * 360 / particles) * Math.PI / 180;
                        line.setAttribute('x1', '50');
                        line.setAttribute('y1', '50');
                        line.setAttribute('x2', 50 + Math.cos(angle) * 40);
                        line.setAttribute('y2', 50 + Math.sin(angle) * 40);
                        line.setAttribute('stroke', '#f00');
                        line.setAttribute('stroke-width', '3');
                        svg.appendChild(line);
                    }

                    explosion.appendChild(svg);
                    document.body.appendChild(explosion);
                    explosion.style.animation = 'explode 0.5s forwards';

                    shakeScreen();
                    playSound(200, 'square', 0.3);

                    setTimeout(() => {
                        document.body.removeChild(explosion);
                    }, 500);
                }

                function shakeScreen() {
                    document.body.style.transform =
                        \`translate(\${Math.random() * 10 - 5}px, \${Math.random() * 10 - 5}px)\`;
                    setTimeout(() => {
                        document.body.style.transform = 'none';
                    }, 50);
                }

                function playSound(freq, type, duration) {
                    if (!audioContext) return;

                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.type = type;
                    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                }
            `,
            css: `
                .explosion {
                    position: absolute;
                    width: 100px;
                    height: 100px;
                    pointer-events: none;
                }

                @keyframes explode {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
            `,
            context:
                "Comprehensive impact and explosion system with visual and audio feedback",
            metadata: {
                visual_impact: "high",
                performance: "optimized",
                features: [
                    "SVG-based explosions",
                    "screen shake",
                    "sound effects",
                    "particle effects",
                ],
            },
        },
    },
    {
        type: "layout",
        pattern_name: "Advanced Game Modes System",
        content: {
            html: `
                <div class="gamemodes-screen" id="gamemodesScreen">
                    <button class="back-button" onclick="returnToTitleScreen()">Back</button>
                    <h1>GAME MODES</h1>
                    <div class="game-modes">
                        <div class="mode-buttons">
                            <button class="mode-button selected" data-mode="classic">
                                Classic Mode
                                <span class="mode-description">The original chase experience!</span>
                            </button>
                            <button class="mode-button" data-mode="survival">
                                Survival Mode
                                <span class="mode-description">Double the cops, double the score!</span>
                            </button>
                            <button class="mode-button" data-mode="maze">
                                Maze Mode
                                <span class="mode-description">Navigate through a complex maze of barriers!</span>
                            </button>
                            <button class="mode-button" data-mode="time-trial">
                                Time Trial
                                <span class="mode-description">Race against the clock! Each cop adds time!</span>
                            </button>
                        </div>
                    </div>
                </div>
            `,
            js: `
                function startGame() {
                    switch(currentGameMode) {
                        case 'survival':
                            copSpeed = 4;
                            spawnInterval = initialSpawnInterval / 2;
                            break;
                        case 'maze':
                            createMazeObstacles();
                            copSpeed = 3;
                            spawnInterval = initialSpawnInterval * 1.2;
                            break;
                        case 'time-trial':
                            copSpeed = 3.5;
                            spawnInterval = initialSpawnInterval;
                            startTimer(60);
                            break;
                        case 'classic':
                        default:
                            copSpeed = 3;
                            spawnInterval = initialSpawnInterval;
                            break;
                    }

                    createObstacles();
                    startTime = new Date().getTime();
                    timerInterval = setInterval(updateTimer, 100);
                    gameLoop = setInterval(updateCops, 16);
                    spawnLoop = setInterval(createCop, spawnInterval);
                    speedIncreaseInterval = setInterval(increaseCopSpeed, 10000);
                    copIncreaseInterval = setInterval(increaseCopSpawnRate, 15000);
                }
            `,
            css: `
                .gamemodes-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    color: white;
                    font-family: Arial, sans-serif;
                    transition: opacity 0.5s;
                }

                .mode-button {
                    padding: 20px 30px;
                    margin: 10px;
                    font-size: 20px;
                    background: rgba(0, 255, 0, 0.2);
                    border: 2px solid #0f0;
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 300px;
                }

                .mode-button:hover {
                    background: rgba(0, 255, 0, 0.3);
                    transform: scale(1.05);
                }

                .mode-button.selected {
                    background: rgba(0, 255, 0, 0.4);
                    box-shadow: 0 0 20px #0f0;
                }
            `,
            context:
                "Comprehensive game modes system with different gameplay variations",
            metadata: {
                complexity: "high",
                replayability: "high",
                features: [
                    "multiple game modes",
                    "dynamic difficulty",
                    "mode-specific mechanics",
                    "persistent settings",
                ],
            },
        },
    },
    {
        type: "animation",
        pattern_name: "Police Siren Alarm Audio System",
        content: {
            js: `
                let audioContext;

                function initAudio() {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                function playSound(freq, type, duration) {
                    if (!audioContext) return;

                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.type = type;
                    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                }

                // Cop siren sound
                const sirenInterval = setInterval(() => {
                    if (!gameIsOver) {
                        // Alternating frequencies for wailing effect
                        playSound(800, 'sine', 0.15);
                        setTimeout(() => {
                            playSound(600, 'sine', 0.15);
                        }, 200);
                    } else {
                        clearInterval(sirenInterval);
                    }
                }, 800);

                // Collision/Explosion sounds
                function playExplosionSound() {
                    if (audioContext) {
                        playSound(100, 'square', 0.3); // Lower frequency for impact
                        setTimeout(() => playSound(80, 'square', 0.2), 100);
                    }
                }

                // Initialize audio on first user interaction
                document.addEventListener('keydown', (e) => {
                    if (!audioContext) initAudio();
                });
            `,
            context:
                "Complete audio system with dynamic sound synthesis and effects",
            metadata: {
                complexity: "high",
                performance: "optimized",
                features: [
                    "Web Audio API integration",
                    "dynamic sound synthesis",
                    "police siren effects",
                    "collision sounds",
                    "user interaction handling",
                ],
            },
        },
    },
];

async function generateEmbedding(pattern: any): Promise<number[]> {
    const textToEmbed = `
        Pattern: ${pattern.pattern_name}
        Type: ${pattern.type}
        Description: ${pattern.content.context}
        ${pattern.content.html ? `HTML: ${pattern.content.html}` : ""}
        ${pattern.content.css ? `CSS: ${pattern.content.css}` : ""}
        ${pattern.content.js ? `JS: ${pattern.content.js}` : ""}
        Metadata: ${JSON.stringify(pattern.content.metadata)}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function storePatterns() {
    // Use constant UUIDs for all patterns since we don't need these functionalities
    const DUMMY_ROOM_ID = "00000000-0000-0000-0000-000000000000";
    const SYSTEM_USER_ID = "11111111-1111-1111-1111-111111111111";
    const SYSTEM_AGENT_ID = "22222222-2222-2222-2222-222222222222";

    for (const pattern of geometryRushPatterns) {
        try {
            const embedding = await generateEmbedding(pattern);
            const patternWithId = {
                id: uuidv4(),
                ...pattern,
                embedding,
                effectiveness_score: 1.0,
                usage_count: 0,
                room_id: DUMMY_ROOM_ID,
                user_id: SYSTEM_USER_ID,
                agent_id: SYSTEM_AGENT_ID,
            };

            const { error } = await supabase
                .from("vector_patterns")
                .insert(patternWithId);

            if (error) {
                console.error(
                    `Failed to store pattern ${pattern.pattern_name}:`,
                    error
                );
            } else {
                console.log(
                    `Successfully stored pattern: ${pattern.pattern_name}`
                );
            }
        } catch (error) {
            console.error(
                `Error processing pattern ${pattern.pattern_name}:`,
                error
            );
        }
    }
}

console.log("Starting to store Geometry Rush patterns...");
storePatterns().then(() => {
    console.log("Finished storing patterns");
});
