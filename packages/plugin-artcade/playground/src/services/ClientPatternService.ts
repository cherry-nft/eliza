import {
    GeneratedPattern,
    PatternGenerationError,
    PatternGenerationResponse,
    PatternStorageResponse,
    PatternValidationError,
} from "../shared/types/pattern.types";
import { GamePattern } from "../../../src/types/patterns";
import { PatternEffectivenessMetrics } from "../../../src/types/effectiveness";
import { CLIENT_CONFIG } from "../config/clientConfig";

interface EvolutionOptions {
    mutationRate: number;
    populationSize: number;
}

export class ClientPatternService {
    private readonly baseUrl: string;
    private readonly logger: (level: "info" | "error", ...args: any[]) => void;

    constructor(baseUrl = CLIENT_CONFIG.API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.logger = this.createLogger();
        this.logger("info", "Service initialized");
    }

    private createLogger() {
        return (level: "info" | "error", ...args: any[]) => {
            const prefix = `[ClientPatternService]`;
            if (level === "error") {
                console.error(prefix, ...args);
            } else {
                console.log(prefix, ...args);
            }
        };
    }

    private async fetchWithLogging<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const fullUrl = `${this.baseUrl}${endpoint}`;
        this.logger("info", `Fetching ${endpoint}`, {
            options: { ...options, headers: options.headers },
        });

        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            const responseData = await response.json();

            if (!response.ok) {
                this.logger(
                    "error",
                    `HTTP error ${response.status}:`,
                    responseData
                );

                if (responseData.error?.details?.validationErrors) {
                    throw new PatternValidationError(
                        responseData.error.message || `Validation failed`,
                        responseData.error.details.validationErrors
                    );
                }

                throw new PatternGenerationError(
                    responseData.error?.message ||
                        `HTTP error ${response.status}`,
                    responseData.error?.details
                );
            }

            this.logger(
                "info",
                `Successful response from ${endpoint}:`,
                responseData
            );
            return responseData;
        } catch (error) {
            this.logger("error", `Request failed:`, error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            this.logger("info", "Performing health check");
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();

            if (!response.ok || !data.status) {
                this.logger("error", "Health check failed:", data);
                return false;
            }

            this.logger("info", "Health check passed:", data);
            return data.status === "healthy";
        } catch (error) {
            this.logger("error", "Health check failed with error:", error);
            return false;
        }
    }

    async generatePattern(prompt: string): Promise<PatternGenerationResponse> {
        this.logger("info", "Generating pattern with prompt:", prompt);

        try {
            const response =
                await this.fetchWithLogging<PatternGenerationResponse>(
                    "/generate",
                    {
                        method: "POST",
                        body: JSON.stringify({ prompt }),
                    }
                );

            return response;
        } catch (error) {
            if (
                error instanceof PatternValidationError ||
                error instanceof PatternGenerationError
            ) {
                return {
                    success: false,
                    error: {
                        message: error.message,
                        details:
                            error instanceof PatternValidationError
                                ? { validationErrors: error.validationErrors }
                                : error instanceof PatternGenerationError
                                  ? error.details
                                  : undefined,
                    },
                };
            }

            return {
                success: false,
                error: {
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error occurred",
                },
            };
        }
    }

    async getGeneratedPattern(prompt: string): Promise<GeneratedPattern> {
        const response = await this.generatePattern(prompt);
        if (!response.success || !response.data) {
            throw new PatternGenerationError(
                response.error?.message || "Failed to generate pattern",
                response.error?.details
            );
        }
        return response.data;
    }

    async getAllPatterns(): Promise<GamePattern[]> {
        return this.fetchWithLogging<GamePattern[]>("/patterns");
    }

    async searchSimilarPatterns(pattern: GamePattern): Promise<GamePattern[]> {
        return this.fetchWithLogging<GamePattern[]>(
            "/patterns/search/similar",
            {
                method: "POST",
                body: JSON.stringify({
                    html: pattern.content.html,
                    type: pattern.type,
                }),
            }
        );
    }

    async comparePatterns(
        sourceHtml: string,
        targetPattern: GamePattern
    ): Promise<PatternEffectivenessMetrics> {
        return this.fetchWithLogging<PatternEffectivenessMetrics>(
            "/patterns/compare",
            {
                method: "POST",
                body: JSON.stringify({
                    sourceHtml,
                    targetPattern,
                    include_extended_metrics: true,
                }),
            }
        );
    }

    async evolvePattern(
        pattern: GamePattern,
        options: EvolutionOptions & {
            patternType:
                | "animation"
                | "layout"
                | "interaction"
                | "style"
                | "game_mechanic";
        }
    ): Promise<GamePattern> {
        this.logger("info", "Evolving pattern with options:", options);

        try {
            // Configure evolution based on pattern type
            const evolutionConfig = {
                populationSize: options.populationSize,
                maxGenerations: 1, // We want immediate feedback for the UI
                mutationRate: options.mutationRate,
                crossoverRate: 0.8,
                elitismCount: 1,
                tournamentSize: 3,
            };

            // Create targeted mutation operators based on pattern type
            const mutationOperators = this.createTargetedMutationOperators(
                options.patternType
            );

            const response = await this.fetchWithLogging<{
                success: boolean;
                data?: {
                    evolved_html: string;
                    applied_patterns: string[];
                    fitness_scores: Record<string, number>;
                };
            }>("/patterns/evolve", {
                method: "POST",
                body: JSON.stringify({
                    pattern: {
                        html: pattern.content.html,
                        type: options.patternType,
                        mutation_operators: mutationOperators,
                    },
                    config: evolutionConfig,
                }),
            });

            if (!response.success || !response.data) {
                throw new Error("Evolution failed");
            }

            // Create evolved pattern with the same structure as original
            return {
                ...pattern,
                content: {
                    ...pattern.content,
                    html: response.data.evolved_html,
                    metadata: {
                        ...pattern.content.metadata,
                        evolution: {
                            parent_pattern_id: pattern.id,
                            applied_patterns: response.data.applied_patterns,
                            mutation_type: options.patternType,
                            fitness_scores: response.data.fitness_scores,
                        },
                    },
                },
            };
        } catch (error) {
            this.logger("error", "Evolution failed:", error);
            throw error;
        }
    }

    private createTargetedMutationOperators(
        patternType: GamePattern["type"]
    ): Array<{
        name: string;
        weight: number;
        type: string;
    }> {
        switch (patternType) {
            case "animation":
                return [
                    { name: "add_transition", weight: 1, type: "css" },
                    { name: "add_keyframe", weight: 1, type: "css" },
                    { name: "modify_timing", weight: 0.5, type: "css" },
                ];
            case "layout":
                return [
                    { name: "adjust_grid", weight: 1, type: "css" },
                    { name: "modify_flexbox", weight: 1, type: "css" },
                    { name: "update_positioning", weight: 0.5, type: "css" },
                ];
            case "interaction":
                return [
                    { name: "add_event_listener", weight: 1, type: "js" },
                    { name: "enhance_controls", weight: 1, type: "js" },
                    { name: "add_feedback", weight: 0.5, type: "js" },
                ];
            case "style":
                return [
                    { name: "update_colors", weight: 1, type: "css" },
                    { name: "modify_typography", weight: 1, type: "css" },
                    { name: "enhance_visuals", weight: 0.5, type: "css" },
                ];
            case "game_mechanic":
                return [
                    { name: "add_scoring", weight: 1, type: "js" },
                    { name: "enhance_collision", weight: 1, type: "js" },
                    { name: "add_powerup", weight: 0.5, type: "js" },
                    { name: "add_obstacle", weight: 0.5, type: "js" },
                ];
            default:
                return [];
        }
    }

    async storeExistingPattern(
        html: string,
        patternName: string,
        type: GamePattern["type"] = "game_mechanic"
    ): Promise<PatternGenerationResponse> {
        this.logger("info", `Storing existing pattern: ${patternName}`);

        try {
            const patternData = {
                content: {
                    html,
                    context: "pattern",
                    metadata: {},
                },
                type,
                pattern_name: patternName,
            };

            const response =
                await this.fetchWithLogging<PatternStorageResponse>("/store", {
                    method: "POST",
                    body: JSON.stringify(patternData),
                });

            if (!response.success) {
                throw new PatternGenerationError(
                    response.error?.message || "Failed to store pattern",
                    response.error?.details
                );
            }

            return {
                success: true,
                data: {
                    title: patternName,
                    description: "Stored HTML pattern",
                    html: html,
                    plan: {
                        coreMechanics: [],
                        visualElements: [],
                        interactivity: [],
                        interactionFlow: [],
                        stateManagement: {
                            variables: [],
                            updates: [],
                        },
                        assetRequirements: {
                            scripts: [],
                            styles: [],
                            fonts: [],
                            images: [],
                            animations: [],
                        },
                    },
                    thumbnail: {
                        alt: patternName,
                        backgroundColor: "#ffffff",
                        elements: [],
                    },
                },
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error occurred",
                    details:
                        error instanceof PatternGenerationError
                            ? error.details
                            : undefined,
                },
            };
        }
    }
}

// Create and export singleton instance
export const clientPatternService = new ClientPatternService();
