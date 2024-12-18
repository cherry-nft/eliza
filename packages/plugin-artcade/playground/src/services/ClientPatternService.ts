import { GamePattern } from "../../../src/types/patterns";

export interface PatternEvolutionConfig {
    populationSize?: number;
    mutationRate?: number;
    preservedSections?: { code: string; type: string }[];
}

export class ClientPatternService {
    private baseUrl = "http://localhost:3001/api/patterns";

    constructor() {
        console.log("[ClientPatternService] Initialized");
    }

    private async fetchWithLogging(
        endpoint: string,
        options: RequestInit = {}
    ) {
        console.log(
            `[ClientPatternService] Fetching ${endpoint} with options:`,
            options
        );
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    `[ClientPatternService] HTTP error ${response.status}:`,
                    errorText
                );
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(
                `[ClientPatternService] Successful response from ${endpoint}:`,
                data
            );
            return data;
        } catch (error) {
            console.error(
                `[ClientPatternService] Error in fetchWithLogging:`,
                error
            );
            throw error;
        }
    }

    async generatePattern(prompt: string): Promise<GamePattern> {
        console.log(
            "[ClientPatternService] Generating pattern with prompt:",
            prompt
        );
        return this.fetchWithLogging("/generate", {
            method: "POST",
            body: JSON.stringify({ prompt }),
        });
    }

    async findSimilarPatterns(
        pattern: GamePattern,
        limit: number = 5
    ): Promise<GamePattern[]> {
        console.log(
            "[ClientPatternService] Finding similar patterns for:",
            pattern.type
        );
        return this.fetchWithLogging("/similar", {
            method: "POST",
            body: JSON.stringify({ pattern, limit }),
        });
    }

    async comparePatterns(generatedHtml: string, pattern: GamePattern) {
        console.log("[ClientPatternService] Comparing patterns");
        return this.fetchWithLogging("/compare", {
            method: "POST",
            body: JSON.stringify({ generatedHtml, pattern }),
        });
    }

    async evolvePattern(pattern: GamePattern, config: PatternEvolutionConfig) {
        console.log(
            "[ClientPatternService] Evolving pattern with config:",
            config
        );
        return this.fetchWithLogging("/evolve", {
            method: "POST",
            body: JSON.stringify({ pattern, config }),
        });
    }

    async getAllPatterns(): Promise<GamePattern[]> {
        console.log("[ClientPatternService] Retrieving all patterns");
        return this.fetchWithLogging("/list");
    }

    async storePattern(pattern: GamePattern): Promise<{ success: boolean }> {
        console.log("[ClientPatternService] Storing pattern:", pattern.type);
        return this.fetchWithLogging("/store", {
            method: "POST",
            body: JSON.stringify({ pattern }),
        });
    }
}
