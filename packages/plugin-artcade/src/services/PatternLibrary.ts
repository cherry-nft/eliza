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
        return powerUpElements.join("\n");
    }

    private extractPowerUpLogic(html: string): string {
        const powerUpScript =
            html.match(/addPowerup[\s\S]*?removePowerup[\s\S]*?}/g) || [];
        return powerUpScript.join("\n");
    }
}
