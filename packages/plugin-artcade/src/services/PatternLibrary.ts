import { Service } from "@ai16z/eliza";
import { v4 as uuidv4 } from "uuid";

interface GamePattern {
    id: string;
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
            game_mechanics?: {
                type: string;
                properties: Record<string, any>;
            }[];
        };
    };
    embedding: number[];
    effectiveness_score: number;
    usage_count: number;
    created_at?: Date;
    last_used?: Date;
}

interface PatternSearchResult {
    pattern: GamePattern;
    similarity: number;
}

export class PatternLibrary {
    private vectorDb: any;
    private staging: any;
    private runtime: any;

    constructor() {
        this.vectorDb = null;
        this.staging = null;
        this.runtime = null;
    }

    async initialize(runtime: any) {
        this.runtime = runtime;
        this.vectorDb = runtime.getService("VectorDatabase");
        this.staging = runtime.getService("PatternStaging");
        this.runtime.logger.info("PatternLibrary service initialized");
    }

    async storePattern(pattern: Partial<GamePattern>): Promise<string> {
        if (!this.staging) {
            throw new Error("PatternLibrary not initialized");
        }

        // Create a complete pattern with defaults
        const completePattern: GamePattern = {
            id: uuidv4(),
            type: pattern.type || "game_mechanic",
            pattern_name: pattern.pattern_name || `pattern_${Date.now()}`,
            content: {
                html: pattern.content?.html || "",
                css: pattern.content?.css,
                js: pattern.content?.js,
                context: pattern.content?.context || "game",
                metadata: {
                    ...pattern.content?.metadata,
                    game_mechanics:
                        pattern.content?.metadata?.game_mechanics || [],
                },
            },
            embedding: pattern.embedding || [],
            effectiveness_score: pattern.effectiveness_score || 1.0,
            usage_count: 0,
            created_at: new Date(),
            last_used: new Date(),
        };

        // Stage the pattern first
        const stagingId = await this.staging.stagePattern(completePattern, {
            source: "pattern_library",
            location: {
                file: "pattern_library",
                start_line: 0,
                end_line: 0,
            },
        });

        this.runtime.logger.info(`Pattern staged with ID: ${stagingId}`);
        return stagingId;
    }

    async findSimilarPatterns(
        pattern: Partial<GamePattern>,
        threshold: number = 0.85,
        limit: number = 5
    ): Promise<PatternSearchResult[]> {
        if (!this.vectorDb) {
            throw new Error("PatternLibrary not initialized");
        }

        if (!pattern.embedding) {
            throw new Error(
                "Pattern must have an embedding for similarity search"
            );
        }

        const results = await this.vectorDb.findSimilarPatterns(
            pattern.embedding,
            pattern.type || "game_mechanic",
            threshold,
            limit
        );

        return results;
    }

    async updateEffectivenessScore(
        patternId: string,
        score: number
    ): Promise<void> {
        if (!this.vectorDb) {
            throw new Error("PatternLibrary not initialized");
        }

        const pattern = await this.vectorDb.getPattern(patternId);
        if (!pattern) {
            throw new Error(`Pattern ${patternId} not found`);
        }

        // Update the effectiveness score with exponential moving average
        const alpha = 0.3; // Weight for new score
        const newScore =
            alpha * score + (1 - alpha) * pattern.effectiveness_score;

        await this.vectorDb.updatePattern(patternId, {
            effectiveness_score: newScore,
            usage_count: pattern.usage_count + 1,
            last_used: new Date(),
        });

        this.runtime.logger.info(
            `Updated pattern ${patternId} score to ${newScore} (usage count: ${
                pattern.usage_count + 1
            })`
        );
    }

    async extractPatterns(html: string): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];

        // Extract animations
        const animationPatterns = await this.extractAnimationPatterns(html);
        patterns.push(...animationPatterns);

        // Extract layouts
        const layoutPatterns = await this.extractLayoutPatterns(html);
        patterns.push(...layoutPatterns);

        // Extract interactions
        const interactionPatterns = await this.extractInteractionPatterns(html);
        patterns.push(...interactionPatterns);

        // Extract styles
        const stylePatterns = await this.extractStylePatterns(html);
        patterns.push(...stylePatterns);

        // Extract game mechanics (existing functionality)
        const gameMechanics = await this.extractGameMechanics(html);
        patterns.push(...gameMechanics);

        return patterns;
    }

    private async extractAnimationPatterns(
        html: string
    ): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];
        const animationElements = html.match(/<[^>]+animation:[^>]+>/g) || [];
        const keyframeRules =
            html.match(/@keyframes\s+([^{]+)\s*{([^}]+)}/g) || [];

        if (animationElements.length > 0 || keyframeRules.length > 0) {
            patterns.push({
                id: uuidv4(),
                type: "animation",
                pattern_name: "animation_pattern",
                content: {
                    html: animationElements.join("\n"),
                    css: keyframeRules.join("\n"),
                    context: "animation",
                    metadata: {
                        visual_type: "animation",
                        animation_duration: this.extractAnimationDuration(html),
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        return patterns;
    }

    private async extractLayoutPatterns(html: string): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];
        const layoutElements =
            html.match(/<[^>]+(display:|grid-|flex-)[^>]+>/g) || [];

        if (layoutElements.length > 0) {
            patterns.push({
                id: uuidv4(),
                type: "layout",
                pattern_name: "layout_pattern",
                content: {
                    html: layoutElements.join("\n"),
                    context: "layout",
                    metadata: {
                        visual_type: "layout",
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        return patterns;
    }

    private async extractInteractionPatterns(
        html: string
    ): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];
        const interactionElements =
            html.match(/<[^>]+(onclick|onmouseover|draggable)[^>]+>/g) || [];

        if (interactionElements.length > 0) {
            patterns.push({
                id: uuidv4(),
                type: "interaction",
                pattern_name: "interaction_pattern",
                content: {
                    html: interactionElements.join("\n"),
                    context: "interaction",
                    metadata: {
                        interaction_type: "user_input",
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        return patterns;
    }

    private async extractStylePatterns(html: string): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];
        const styleElements = html.match(/<[^>]+(style="[^"]+")/g) || [];
        const colorScheme = this.extractColorScheme(html);

        if (styleElements.length > 0) {
            patterns.push({
                id: uuidv4(),
                type: "style",
                pattern_name: "style_pattern",
                content: {
                    html: styleElements.join("\n"),
                    context: "style",
                    metadata: {
                        visual_type: "style",
                        color_scheme: colorScheme,
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        return patterns;
    }

    private extractAnimationDuration(html: string): string {
        const durationMatch = html.match(/animation(?:-duration)?:\s*([^;]+)/);
        if (!durationMatch) return "0s";

        // Extract just the duration part from animation shorthand
        const parts = durationMatch[1].split(/\s+/);
        const duration = parts.find((part) =>
            part.match(/^\d+(?:\.\d+)?[ms]?s$/)
        );
        return duration || "0s";
    }

    private extractColorScheme(html: string): string[] {
        const colorMatches =
            html.match(/#[0-9a-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/gi) || [];
        return [...new Set(colorMatches)];
    }

    async extractGameMechanics(html: string): Promise<GamePattern[]> {
        const patterns: GamePattern[] = [];

        // Extract collision mechanics
        if (html.includes('data-collision="true"')) {
            patterns.push({
                id: uuidv4(),
                type: "game_mechanic",
                pattern_name: "collision_detection",
                content: {
                    html: this.extractCollisionElements(html),
                    js: this.extractCollisionLogic(html),
                    context: "collision",
                    metadata: {
                        interaction_type: "collision",
                        game_mechanics: [
                            {
                                type: "collision",
                                properties: {
                                    uses_bounding_box: true,
                                    frame_rate: 60,
                                },
                            },
                        ],
                    },
                },
                embedding: [], // Will be generated by VectorDatabase
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        // Extract movement mechanics
        if (html.includes("data-speed")) {
            patterns.push({
                id: uuidv4(),
                type: "game_mechanic",
                pattern_name: "movement_controls",
                content: {
                    html: this.extractMovementElements(html),
                    js: this.extractMovementLogic(html),
                    context: "movement",
                    metadata: {
                        interaction_type: "movement",
                        game_mechanics: [
                            {
                                type: "movement",
                                properties: {
                                    uses_keyboard: true,
                                    uses_touch: true,
                                    speed_attribute: true,
                                },
                            },
                        ],
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        // Extract power-up mechanics
        if (html.includes("game-powerup")) {
            patterns.push({
                id: uuidv4(),
                type: "game_mechanic",
                pattern_name: "power_up_system",
                content: {
                    html: this.extractPowerUpElements(html),
                    js: this.extractPowerUpLogic(html),
                    context: "power_ups",
                    metadata: {
                        interaction_type: "power_up",
                        game_mechanics: [
                            {
                                type: "power_up",
                                properties: {
                                    duration_based: true,
                                    effect_types: ["speed", "invincible"],
                                },
                            },
                        ],
                    },
                },
                embedding: [],
                effectiveness_score: 1.0,
                usage_count: 0,
            });
        }

        return patterns;
    }

    private extractCollisionElements(html: string): string {
        const collisionElements =
            html.match(/<div[^>]*data-collision="true"[^>]*>.*?<\/div>/g) || [];

        // Add keyboard event listener if not present
        if (
            collisionElements.length > 0 &&
            !html.includes('addEventListener("keydown"')
        ) {
            collisionElements[0] = `${collisionElements[0]}
            <script>
                document.addEventListener("keydown", (e) => {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;
                    switch(e.key) {
                        case "ArrowLeft": player.style.left = (parseInt(player.style.left || 0) - speed) + 'px'; break;
                        case "ArrowRight": player.style.left = (parseInt(player.style.left || 0) + speed) + 'px'; break;
                        case "ArrowUp": player.style.top = (parseInt(player.style.top || 0) - speed) + 'px'; break;
                        case "ArrowDown": player.style.top = (parseInt(player.style.top || 0) + speed) + 'px'; break;
                    }
                });
            </script>`;
        }

        return collisionElements.join("\n");
    }

    private extractCollisionLogic(html: string): string {
        const collisionScript =
            html.match(
                /setInterval\(\s*\(\)\s*=>\s*{[\s\S]*?}\s*,\s*16\s*\);/g
            ) || [];
        return collisionScript.join("\n");
    }

    private extractMovementElements(html: string): string {
        const movementElements =
            html.match(/<div[^>]*data-speed[^>]*>.*?<\/div>/g) || [];
        return movementElements.join("\n");
    }

    private extractMovementLogic(html: string): string {
        const movementScript =
            html.match(/document\.addEventListener\("keydown"[\s\S]*?}\);/g) ||
            [];
        return movementScript.join("\n");
    }

    private extractPowerUpElements(html: string): string {
        const powerUpElements =
            html.match(/<div[^>]*game-powerup[^>]*>.*?<\/div>/g) || [];

        // Add game state if not present
        if (powerUpElements.length > 0 && !html.includes("gameState")) {
            powerUpElements[0] = `${powerUpElements[0]}
            <script>
                const gameState = {
                    score: 0,
                    health: 100,
                    powerups: [],
                    addPowerup: function(effect, duration) {
                        this.powerups.push({ effect, expires: Date.now() + duration });
                        setTimeout(() => this.removePowerup(effect), duration);
                    },
                    removePowerup: function(effect) {
                        this.powerups = this.powerups.filter(p => p.effect !== effect);
                    }
                };
            </script>`;
        }

        return powerUpElements.join("\n");
    }

    private extractPowerUpLogic(html: string): string {
        const powerUpScript =
            html.match(/addPowerup[\s\S]*?removePowerup[\s\S]*?}/g) || [];
        return powerUpScript.join("\n");
    }
}
