import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GamePattern } from "../types/patterns";
import { parse } from "node-html-parser";
import {
    PatternEffectivenessMetrics,
    ClaudeUsageContext,
    PatternFeatures,
} from "../types/effectiveness";

// Custom error class for database operations
class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = "DatabaseError";
        if (cause) {
            this.cause = cause;
        }
    }
}

export class VectorSupabase {
    private supabase;
    private openai;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private readonly EMBEDDING_DIMENSION = 1536;

    constructor(supabaseUrl: string) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase service role key");
        }

        this.supabase = createClient(
            supabaseUrl,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Missing OpenAI API key");
        }

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    private async generateEmbedding(pattern: GamePattern): Promise<number[]> {
        const textToEmbed = `
            Pattern: ${pattern.pattern_name}
            Type: ${pattern.type}
            Description: ${pattern.content.context}
            HTML: ${pattern.content.html}
            ${pattern.content.css ? `CSS: ${pattern.content.css}` : ""}
            ${pattern.content.js ? `JS: ${pattern.content.js}` : ""}
            Metadata: ${JSON.stringify(pattern.content.metadata)}
        `.trim();

        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: textToEmbed,
            encoding_format: "float",
        });

        return response.data[0].embedding;
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        try {
            const embedding = await this.generateEmbedding(pattern);

            const { error } = await this.supabase
                .from("vector_patterns")
                .insert({
                    ...pattern,
                    embedding,
                });

            if (error) throw error;
        } catch (error) {
            console.error("Failed to store pattern:", error);
            throw error;
        }
    }

    async findSimilarPatterns(
        searchText: string,
        threshold = 0.5,
        limit = 5
    ): Promise<GamePattern[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: searchText,
                encoding_format: "float",
            });
            const searchEmbedding = response.data[0].embedding;

            const { data, error } = await this.supabase.rpc("match_patterns", {
                query_embedding: searchEmbedding,
                match_threshold: threshold,
                match_count: limit,
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to find similar patterns:", error);
            throw error;
        }
    }

    async getAllPatterns(): Promise<GamePattern[]> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("*");

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to get patterns:", error);
            throw error;
        }
    }

    async getPatternById(id: string): Promise<GamePattern> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Failed to get pattern:", error);
            throw error;
        }
    }

    async updatePatternUsageCount(id: string): Promise<void> {
        try {
            const { error } = await this.supabase.rpc(
                "increment_pattern_usage",
                {
                    pattern_id: id,
                }
            );

            if (error) throw error;
        } catch (error) {
            console.error("Failed to update pattern usage count:", error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const { data, error } = await this.supabase
                .from("vector_patterns")
                .select("count");
            return !error;
        } catch (error) {
            console.error("Database health check failed", { error });
            return false;
        }
    }

    async cleanupOldPatterns(cutoffDays: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

        try {
            const { error } = await this.supabase
                .from("vector_patterns")
                .delete()
                .lt("last_used", cutoffDate.toISOString())
                .eq("usage_count", 0);

            if (error) throw error;
        } catch (error) {
            console.error("Failed to cleanup old patterns", {
                error,
                cutoffDays,
            });
            throw new DatabaseError("Pattern cleanup failed", error);
        }
    }

    async trackClaudeUsage(context: ClaudeUsageContext): Promise<void> {
        const { prompt, generated_html, matched_patterns, quality_assessment } =
            context;

        for (const match of matched_patterns) {
            const { pattern_id, similarity, features_used } = match;

            try {
                // Get existing pattern
                const { data: pattern, error } = await this.supabase
                    .from("vector_patterns")
                    .select("*")
                    .eq("id", pattern_id)
                    .single();

                if (error || !pattern) {
                    console.warn(`Pattern ${pattern_id} not found`);
                    continue;
                }

                const currentStats = pattern.usage_stats || {
                    total_uses: 0,
                    successful_uses: 0,
                    average_similarity: 0,
                    last_used: new Date(),
                };

                // Update usage stats
                const newStats = {
                    total_uses: currentStats.total_uses + 1,
                    successful_uses:
                        currentStats.successful_uses +
                        (similarity > 0.8 ? 1 : 0),
                    average_similarity:
                        (currentStats.average_similarity *
                            currentStats.total_uses +
                            similarity) /
                        (currentStats.total_uses + 1),
                    last_used: new Date(),
                };

                // Calculate new effectiveness score
                const newScore =
                    this.calculateEffectivenessScore(quality_assessment);

                // Update pattern
                const { error: updateError } = await this.supabase
                    .from("vector_patterns")
                    .update({
                        effectiveness_score: newScore,
                        usage_stats: newStats,
                        claude_usage_metrics: {
                            ...(pattern.claude_usage_metrics || {}),
                            last_usage: {
                                direct_reuse: similarity > 0.9,
                                structural_similarity: similarity,
                                feature_adoption: features_used,
                                timestamp: new Date(),
                            },
                        },
                    })
                    .eq("id", pattern_id);

                if (updateError) throw updateError;
            } catch (error) {
                console.error("Failed to track Claude usage", {
                    error,
                    pattern_id,
                });
                throw new DatabaseError("Failed to track Claude usage", error);
            }
        }
    }

    private calculateEffectivenessScore(
        scores: PatternEffectivenessMetrics["quality_scores"]
    ): number {
        const weights = {
            visual: 0.25,
            interactive: 0.25,
            functional: 0.25,
            performance: 0.25,
        };

        return Object.entries(scores).reduce(
            (score, [key, value]) =>
                score + value * weights[key as keyof typeof weights],
            0
        );
    }

    private extractKeywords(prompt: string): string[] {
        // Split on whitespace and special characters, convert to lowercase
        const words = prompt
            .toLowerCase()
            .split(/[\s,.!?;:()\[\]{}'"]+/)
            .filter(
                (word) =>
                    // Filter out common words and ensure minimum length
                    word.length >= 3 &&
                    ![
                        "the",
                        "and",
                        "with",
                        "for",
                        "from",
                        "that",
                        "this",
                        "have",
                        "will",
                    ].includes(word)
            );

        // Get unique words and take top 10
        return [...new Set(words)].slice(0, 10);
    }

    private extractPatternFeatures(html: string): PatternFeatures {
        const root = parse(html);

        return {
            visual: {
                hasAnimations:
                    html.includes("@keyframes") || html.includes("animation"),
                colorCount: (html.match(/#[0-9a-f]{3,6}|rgb|rgba|hsl/gi) || [])
                    .length,
                layoutType: this.detectLayoutType(html),
            },
            interactive: {
                eventListeners: this.extractEventListeners(html),
                hasUserInput:
                    html.includes("input") ||
                    html.includes("button") ||
                    html.includes("form"),
                stateChanges:
                    html.includes("useState") ||
                    html.includes("setState") ||
                    html.includes("classList.toggle"),
            },
            functional: {
                hasGameLogic: this.detectGameLogic(html),
                dataManagement:
                    html.includes("data-") || html.includes("useState"),
                complexity: this.calculateComplexity(html),
            },
        };
    }

    private detectLayoutType(html: string): "flex" | "grid" | "standard" {
        if (html.includes("display: grid") || html.includes("grid-template"))
            return "grid";
        if (html.includes("display: flex")) return "flex";
        return "standard";
    }

    private extractEventListeners(html: string): string[] {
        const events = html.match(/on[A-Z][a-zA-Z]+=|addEventListener/g) || [];
        return events.map((e) =>
            e.replace("on", "").replace("=", "").toLowerCase()
        );
    }

    private detectGameLogic(html: string): boolean {
        const gamePatterns = [
            "score",
            "health",
            "level",
            "game",
            "player",
            "collision",
            "requestAnimationFrame",
            "gameLoop",
            "update",
        ];
        return gamePatterns.some((pattern) => html.includes(pattern));
    }

    private calculateComplexity(html: string): number {
        const root = parse(html);
        const depth = this.calculateDOMDepth(root);
        const elements = root.querySelectorAll("*").length;
        const scripts = (html.match(/<script/g) || []).length;

        // Normalize to 0-1 range
        return Math.min(depth * 0.2 + elements * 0.01 + scripts * 0.1, 1);
    }

    private calculateDOMDepth(node: any, depth: number = 0): number {
        if (!node.childNodes || node.childNodes.length === 0) return depth;
        return Math.max(
            ...node.childNodes.map((child) =>
                this.calculateDOMDepth(child, depth + 1)
            )
        );
    }

    async storeMovementPattern(): Promise<void> {
        const movementPattern: GamePattern = {
            id: "movement-system-v1",
            name: "Advanced Vehicle Movement System",
            description:
                "A sophisticated movement system with velocity, friction, and drift mechanics",
            type: "movement",
            code: `
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

    playerX = Math.max(15, Math.min(WORLD_WIDTH - 15, playerX));
    playerY = Math.max(7.5, Math.min(WORLD_HEIGHT - 7.5, playerY));

    cameraX = Math.max(0, Math.min(WORLD_WIDTH - window.innerWidth, playerX - window.innerWidth / 2));
    cameraY = Math.max(0, Math.min(WORLD_HEIGHT - window.innerHeight, playerY - window.innerHeight / 2));

    document.querySelector('.game-world').style.transform = \`translate(\${-cameraX}px, \${-cameraY}px)\`;

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
}`,
            css: `
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
}`,
            metadata: {
                friction: 0.93,
                turnSpeed: 4,
                playerSpeed: 6,
                worldWidth: 4000,
                worldHeight: 4000,
            },
            dependencies: {
                required: ["createTrail"],
                optional: ["gameIsOver", "keys"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "vehicle",
                perspective: "2D",
                cameraStyle: "follow",
            },
        };

        try {
            await this.storePattern(movementPattern);
        } catch (error) {
            console.error("Error storing movement pattern:", error);
            throw error;
        }
    }

    async storeCollisionPattern(): Promise<void> {
        const collisionPattern: GamePattern = {
            id: "collision-system-v1",
            name: "Advanced Collision Detection System",
            description:
                "A comprehensive collision detection system for player, obstacles, and enemies",
            type: "collision",
            code: `
function checkCollisions() {
  if (gameIsOver) return;

  const playerRect = player.getBoundingClientRect();

  // Check player collision with obstacles
  for(let obstacle of obstacles) {
    const obstacleRect = obstacle.element.getBoundingClientRect();
    if (!(playerRect.right < obstacleRect.left ||
          playerRect.left > obstacleRect.right ||
          playerRect.bottom < obstacleRect.top ||
          playerRect.top > obstacleRect.bottom)) {
      gameOver();
      return;
    }
  }

  // Check cop collisions with obstacles
  for(let cop of cops) {
    const copRect = cop.element.getBoundingClientRect();

    // Check cop collision with player
    if (!(playerRect.right < copRect.left ||
          playerRect.left > copRect.right ||
          playerRect.bottom < copRect.top ||
          playerRect.top > copRect.bottom)) {
      gameOver();
      return;
    }

    // Check cop collision with obstacles
    for(let obstacle of obstacles) {
      const obstacleRect = obstacle.element.getBoundingClientRect();
      if (!(copRect.right < obstacleRect.left ||
            copRect.left > obstacleRect.right ||
            copRect.bottom < obstacleRect.top ||
            copRect.top > obstacleRect.bottom)) {
        const points = 50 * scoreMultiplier;
        score += points;
        showScorePopup(cop.x, cop.y, points);
        createExplosion(cop.x, cop.y, 1.5);

        if (audioContext) {
          playSound(100, 'square', 0.3);
          setTimeout(() => playSound(80, 'square', 0.2), 100);
        }

        setTimeout(() => {
          createExplosion(cop.x + Math.random() * 30 - 15,
                         cop.y + Math.random() * 30 - 15, 0.7);
        }, 100);

        setTimeout(() => {
          createExplosion(cop.x + Math.random() * 30 - 15,
                         cop.y + Math.random() * 30 - 15, 0.5);
        }, 200);

        document.querySelector('.game-world').removeChild(cop.element);
        cops.splice(cops.indexOf(cop), 1);
        scoreElement.textContent = score;
        break;
      }
    }
  }

  // Check cop-to-cop collisions
  for(let i = 0; i < cops.length; i++) {
    for(let j = i + 1; j < cops.length; j++) {
      const dx = cops[i].x - cops[j].x;
      const dy = cops[i].y - cops[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if(distance < 30) {
        if (cops[i].sirenInterval) clearInterval(cops[i].sirenInterval);
        if (cops[j].sirenInterval) clearInterval(cops[j].sirenInterval);
        createExplosion(cops[i].x, cops[i].y);
        document.querySelector('.game-world').removeChild(cops[i].element);
        document.querySelector('.game-world').removeChild(cops[j].element);
        cops.splice(j, 1);
        cops.splice(i, 1);
        score += 100;
        scoreElement.textContent = score;
        break;
      }
    }
  }
}`,
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
}`,
            metadata: {
                collisionTypes: [
                    "player-obstacle",
                    "player-enemy",
                    "enemy-obstacle",
                    "enemy-enemy",
                ],
                explosionSize: 100,
                explosionDuration: 500,
                scoreMultiplier: 1,
            },
            dependencies: {
                required: ["createExplosion", "playSound", "showScorePopup"],
                optional: ["gameIsOver", "scoreElement"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "arcade",
                perspective: "2D",
                collisionMethod: "getBoundingClientRect",
            },
        };

        try {
            await this.storePattern(collisionPattern);
        } catch (error) {
            console.error("Error storing collision pattern:", error);
            throw error;
        }
    }

    async storeUIPattern(): Promise<void> {
        const uiPattern: GamePattern = {
            id: "ui-components-v1",
            name: "Game UI Components System",
            description:
                "A complete UI system including score display, timer, game over screen, and customization menu",
            type: "ui",
            html: `
<div class="score">Score: <span id="score">0</span></div>
<div class="high-score">High Score: <span id="highScore">0</span></div>
<div class="timer">Time: <span id="timer">0:00</span></div>
<div class="speed-boost" id="speedBoost">SPEED BOOST!</div>
<div class="game-over" id="gameOver">
  <h2>GAME OVER</h2>
  <p>Score: <span id="scoreOver">0</span></p>
  <p>High Score: <span id="highScoreOver">0</span></p>
  <p>Time: <span id="timerOver">0:00</span></p>
  <button class="return-menu-btn" onclick="returnToMenu()">Return to Menu</button>
</div>
<button class="customize-toggle" id="customizeToggle">Customize</button>
<div class="color-customizer">
  <div class="color-picker">
    <label>Car Color:
      <input type="color" id="carColor" value="#00ff00">
    </label>
    <label>Trail Color:
      <input type="color" id="trailColor" value="#00ff00">
    </label>
  </div>
</div>`,
            css: `
.score {
  position: fixed;
  top: 20px;
  left: 20px;
  color: white;
  font-family: Arial;
  font-size: 24px;
  z-index: 100;
}

.timer {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-family: Arial;
  font-size: 24px;
  z-index: 100;
}

.high-score {
  position: fixed;
  top: 20px;
  right: 20px;
  color: white;
  font-family: Arial;
  font-size: 24px;
  z-index: 100;
}

.speed-boost {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #0f0;
  font-family: Arial;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.3s;
}

.game-over {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: red;
  font-family: Arial;
  font-size: 48px;
  z-index: 1000;
  display: none;
  background: rgba(0, 0, 0, 0.9);
  padding: 40px 60px;
  border-radius: 15px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.5s;
}

.game-over.visible {
  opacity: 1;
}

.return-menu-btn {
  background: #0f0;
  color: black;
  border: none;
  padding: 15px 30px;
  font-size: 24px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s;
}

.return-menu-btn:hover {
  background: #0c0;
  transform: scale(1.1);
  box-shadow: 0 0 20px #0f0;
}

.color-customizer {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 10px;
  z-index: 100;
  transition: transform 0.3s ease-out;
  transform: translateX(-200px);
}

.color-customizer.visible {
  transform: translateX(0);
}

.customize-toggle {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;
  font-family: Arial;
  z-index: 101;
  transition: background-color 0.2s;
}

.customize-toggle:hover {
  background: rgba(0, 0, 0, 0.9);
}`,
            code: `
function updateTimer() {
  if (!gameIsOver) {
    const currentTime = new Date().getTime();
    const elapsedTime = Math.floor((currentTime - startTime) / 1000);
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    timerElement.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
  }
}

function showScorePopup(x, y, points) {
  const popup = document.createElement('div');
  popup.style.cssText = \`
    position: absolute;
    left: \${x}px;
    top: \${y}px;
    color: #0f0;
    font-family: Arial;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 10px #0f0;
    pointer-events: none;
    z-index: 1000;
    animation: scorePopup 1s forwards;
  \`;
  popup.textContent = \`+\${points}\`;
  document.querySelector('.game-world').appendChild(popup);

  setTimeout(() => {
    document.querySelector('.game-world').removeChild(popup);
  }, 1000);
}

function updateCarColor(color) {
  document.documentElement.style.setProperty('--car-color', color);
  document.documentElement.style.setProperty('--car-color-dark', adjustBrightness(color, -20));
}

function updateTrailColor(color) {
  document.documentElement.style.setProperty('--trail-color-transparent', \`\${color}4D\`);
  document.documentElement.style.setProperty('--trail-color-semi', \`\${color}66\`);
}`,
            metadata: {
                components: ["score", "timer", "game-over", "customizer"],
                animations: ["fade", "scale", "slide"],
                colorScheme: {
                    primary: "#0f0",
                    background: "rgba(0, 0, 0, 0.9)",
                    text: "white",
                },
            },
            dependencies: {
                required: ["adjustBrightness"],
                optional: ["gameIsOver", "startTime"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "arcade",
                theme: "neon",
                responsive: true,
            },
        };

        try {
            await this.storePattern(uiPattern);
        } catch (error) {
            console.error("Error storing UI pattern:", error);
            throw error;
        }
    }

    async storeScoringPattern(): Promise<void> {
        const scoringPattern: GamePattern = {
            id: "scoring-system-v1",
            name: "Dynamic Scoring System",
            description:
                "A comprehensive scoring system with multipliers, combos, and visual feedback",
            type: "scoring",
            code: `
function showScorePopup(x, y, points) {
  const popup = document.createElement('div');
  popup.style.cssText = \`
    position: absolute;
    left: \${x}px;
    top: \${y}px;
    color: #0f0;
    font-family: Arial;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 10px #0f0;
    pointer-events: none;
    z-index: 1000;
    animation: scorePopup 1s forwards;
  \`;
  popup.textContent = \`+\${points}\`;
  document.querySelector('.game-world').appendChild(popup);

  if (!document.querySelector('#score-popup-style')) {
    const style = document.createElement('style');
    style.id = 'score-popup-style';
    style.textContent = \`
      @keyframes scorePopup {
        0% {
          transform: translate(-50%, 0) scale(0.5);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50px) scale(1.5);
          opacity: 0;
        }
      }
    \`;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    document.querySelector('.game-world').removeChild(popup);
  }, 1000);
}

function showCombo(multiplier) {
  const combo = document.createElement('div');
  combo.className = 'combo-text';
  combo.textContent = \`\${multiplier}x COMBO!\`;
  document.body.appendChild(combo);

  requestAnimationFrame(() => {
    combo.style.opacity = '1';
    combo.style.transform = 'translateX(-50%) scale(1.2)';
    setTimeout(() => {
      combo.style.opacity = '0';
      combo.style.transform = 'translateX(-50%) scale(0.8)';
      setTimeout(() => document.body.removeChild(combo), 300);
    }, 700);
  });
}`,
            css: `
.combo-text {
  position: fixed;
  left: 50%;
  bottom: 60px;
  transform: translateX(-50%);
  color: #0f0;
  font-family: Arial;
  font-size: 36px;
  text-shadow: 0 0 10px #0f0;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
}

@keyframes scorePopup {
  0% {
    transform: translate(-50%, 0) scale(0.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50px) scale(1.5);
    opacity: 0;
  }
}`,
            metadata: {
                scoreTypes: ["base", "combo", "multiplier"],
                animations: ["popup", "scale", "fade"],
                comboSystem: {
                    duration: 1000,
                    maxMultiplier: 10,
                },
            },
            dependencies: {
                required: [],
                optional: ["gameWorld", "scoreElement"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "arcade",
                visualStyle: "neon",
                feedbackType: "immediate",
            },
        };

        try {
            await this.storePattern(scoringPattern);
        } catch (error) {
            console.error("Error storing scoring pattern:", error);
            throw error;
        }
    }

    async storePoliceEffectsPattern(): Promise<void> {
        const policePattern: GamePattern = {
            id: "police-effects-v1",
            name: "Police Car Visual Effects",
            description:
                "Advanced visual effects for police cars including sirens, movement patterns, and explosions",
            type: "visual-effects",
            code: `
function createCop() {
  const cop = document.createElement('div');
  cop.className = 'cop';
  const side = Math.floor(Math.random() * 4);
  let x, y;

  switch(side) {
    case 0: x = cameraX + Math.random() * window.innerWidth; y = cameraY - 30; break;
    case 1: x = cameraX + window.innerWidth + 30; y = cameraY + Math.random() * window.innerHeight; break;
    case 2: x = cameraX + Math.random() * window.innerWidth; y = cameraY + window.innerHeight + 30; break;
    case 3: x = cameraX - 30; y = cameraY + Math.random() * window.innerHeight; break;
  }

  cop.style.left = x + 'px';
  cop.style.top = y + 'px';
  document.querySelector('.game-world').appendChild(cop);

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

function getSineWaveOffset(timestamp, amplitude = 20, frequency = 0.002) {
  return Math.sin(timestamp * frequency) * amplitude;
}

function getCircularOffset(timestamp, radius = 30, speed = 0.003) {
  return {
    x: Math.cos(timestamp * speed) * radius,
    y: Math.sin(timestamp * speed) * radius
  };
}

function updateCops() {
  const timestamp = Date.now();

  cops.forEach(cop => {
    const dx = playerX - cop.x;
    const dy = playerY - cop.y;
    const baseAngle = Math.atan2(dy, dx);

    let targetAngle = baseAngle;
    let speedMultiplier = 1;

    switch(cop.movementPattern) {
      case 1:
        const sineOffset = getSineWaveOffset(timestamp);
        targetAngle += Math.sin(timestamp * 0.003) * 0.5;
        break;

      case 2:
        const circularOffset = getCircularOffset(timestamp);
        cop.x += circularOffset.x * 0.1;
        cop.y += circularOffset.y * 0.1;
        targetAngle += Math.sin(timestamp * 0.002) * 0.3;
        speedMultiplier = 1.1;
        break;

      case 3:
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
}`,
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

.cop::after {
  content: '';
  position: absolute;
  top: 15%;
  left: 20%;
  width: 60%;
  height: 20%;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 0 5px #fff;
}`,
            metadata: {
                movementPatterns: ["direct", "sine", "circular", "zigzag"],
                visualEffects: ["siren", "flash", "drift"],
                spawnPositions: ["top", "right", "bottom", "left"],
            },
            dependencies: {
                required: ["copSpeed", "playerX", "playerY"],
                optional: ["cameraX", "cameraY"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "chase",
                visualStyle: "neon",
                perspective: "2D",
            },
        };

        try {
            await this.storePattern(policePattern);
        } catch (error) {
            console.error("Error storing police effects pattern:", error);
            throw error;
        }
    }

    async storeSoundEffectsPattern(): Promise<void> {
        const soundPattern: GamePattern = {
            id: "siren-sound-v1",
            name: "Police Siren Sound System",
            description:
                "Dynamic sound effects system using Web Audio API for police sirens and collision sounds",
            type: "audio",
            code: `
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

// Add siren sound when cop is created
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

// Collision sound effects
if (audioContext) {
  playSound(100, 'square', 0.3); // Lower frequency for impact
  setTimeout(() => playSound(80, 'square', 0.2), 100);
}`,
            metadata: {
                audioTypes: ["siren", "collision", "explosion"],
                frequencies: {
                    sirenHigh: 800,
                    sirenLow: 600,
                    collision: 100,
                    explosion: 80,
                },
                waveforms: ["sine", "square"],
            },
            dependencies: {
                required: ["AudioContext"],
                optional: ["gameIsOver"],
            },
            effectiveness: 0,
            usageCount: 0,
            context: {
                gameType: "arcade",
                audioStyle: "retro",
                platform: "web",
            },
        };

        try {
            await this.storePattern(soundPattern);
        } catch (error) {
            console.error("Error storing sound effects pattern:", error);
            throw error;
        }
    }

    private async processAndStorePattern(
        id: string,
        type: GamePattern["type"],
        name: string,
        html: string,
        css: string,
        js: string,
        context: string,
        metadata: any
    ): Promise<void> {
        const pattern: Omit<GamePattern, "embedding"> = {
            id,
            type,
            pattern_name: name,
            content: {
                html,
                css,
                js,
                context,
                metadata,
            },
            effectiveness_score: 0,
            usage_count: 0,
            created_at: new Date(),
        };

        // Generate embedding
        const embedding = await this.generateEmbedding(pattern);

        // Store in Supabase
        const { error } = await this.supabase.from("vector_patterns").insert({
            ...pattern,
            embedding,
        });

        if (error) {
            throw new DatabaseError(`Failed to store pattern ${id}`, error);
        }
    }

    async storeGeometryRushPatterns(): Promise<void> {
        // Store Movement Pattern
        await this.processAndStorePattern(
            "movement-system-v1",
            "game_mechanic",
            "Advanced Vehicle Movement System",
            `<div class="player"></div>`,
            this.movementPattern.css,
            this.movementPattern.code,
            "A sophisticated movement system with velocity, friction, and drift mechanics for a 2D vehicle game",
            {
                game_mechanics: [
                    {
                        type: "movement",
                        properties: {
                            friction: 0.93,
                            turnSpeed: 4,
                            playerSpeed: 6,
                            worldWidth: 4000,
                            worldHeight: 4000,
                        },
                    },
                ],
                dependencies: ["createTrail", "gameIsOver", "keys"],
                visual_type: "2D",
                interaction_type: "keyboard",
            }
        );

        // Store Collision Pattern
        await this.processAndStorePattern(
            "collision-system-v1",
            "game_mechanic",
            "Advanced Collision Detection System",
            `<div class="explosion"></div>`,
            this.collisionPattern.css,
            this.collisionPattern.code,
            "A comprehensive collision detection system for player, obstacles, and enemies in a 2D game",
            {
                game_mechanics: [
                    {
                        type: "collision",
                        properties: {
                            collisionTypes: [
                                "player-obstacle",
                                "player-enemy",
                                "enemy-obstacle",
                                "enemy-enemy",
                            ],
                            explosionSize: 100,
                            explosionDuration: 500,
                        },
                    },
                ],
                dependencies: [
                    "createExplosion",
                    "playSound",
                    "showScorePopup",
                ],
                visual_type: "2D",
                interaction_type: "automatic",
            }
        );

        // Store UI Pattern
        await this.processAndStorePattern(
            "ui-components-v1",
            "layout",
            "Game UI Components System",
            this.uiPattern.html,
            this.uiPattern.css,
            this.uiPattern.code,
            "A complete UI system including score display, timer, game over screen, and customization menu",
            {
                visual_type: "overlay",
                interaction_type: "click",
                color_scheme: ["#0f0", "#f00", "rgba(0, 0, 0, 0.9)", "white"],
                animation_duration: "0.3s",
                dependencies: ["adjustBrightness", "gameIsOver", "startTime"],
            }
        );

        // Store Scoring Pattern
        await this.processAndStorePattern(
            "scoring-system-v1",
            "game_mechanic",
            "Dynamic Scoring System",
            `<div class="combo-text"></div>`,
            this.scoringPattern.css,
            this.scoringPattern.code,
            "A comprehensive scoring system with multipliers, combos, and visual feedback",
            {
                game_mechanics: [
                    {
                        type: "scoring",
                        properties: {
                            comboSystem: {
                                duration: 1000,
                                maxMultiplier: 10,
                            },
                            scoreTypes: ["base", "combo", "multiplier"],
                        },
                    },
                ],
                visual_type: "dynamic",
                animation_duration: "1s",
            }
        );

        // Store Police Effects Pattern
        await this.processAndStorePattern(
            "police-effects-v1",
            "animation",
            "Police Car Visual Effects",
            `<div class="cop"></div>`,
            this.policePattern.css,
            this.policePattern.code,
            "Advanced visual effects for police cars including sirens, movement patterns, and explosions",
            {
                visual_type: "animated",
                animation_duration: "1s",
                game_mechanics: [
                    {
                        type: "movement",
                        properties: {
                            patterns: ["direct", "sine", "circular", "zigzag"],
                            spawnPositions: ["top", "right", "bottom", "left"],
                        },
                    },
                ],
                dependencies: [
                    "copSpeed",
                    "playerX",
                    "playerY",
                    "cameraX",
                    "cameraY",
                ],
            }
        );

        // Store Sound Effects Pattern
        await this.processAndStorePattern(
            "siren-sound-v1",
            "game_mechanic",
            "Police Siren Sound System",
            "",
            "",
            this.soundPattern.code,
            "Dynamic sound effects system using Web Audio API for police sirens and collision sounds",
            {
                game_mechanics: [
                    {
                        type: "audio",
                        properties: {
                            frequencies: {
                                sirenHigh: 800,
                                sirenLow: 600,
                                collision: 100,
                                explosion: 80,
                            },
                            waveforms: ["sine", "square"],
                        },
                    },
                ],
                dependencies: ["AudioContext", "gameIsOver"],
            }
        );
    }
}
