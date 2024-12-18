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
                }),
            }
        );
    }

    async evolvePattern(
        pattern: GamePattern,
        options: EvolutionOptions
    ): Promise<GamePattern> {
        return this.fetchWithLogging<GamePattern>("/patterns/evolve", {
            method: "POST",
            body: JSON.stringify({
                pattern,
                options,
            }),
        });
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
