import {
    GeneratedPattern,
    PatternGenerationError,
    PatternGenerationResponse,
    PatternValidationError,
} from "../shared/types/pattern.types";

interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        details?: any;
    };
}

export class ClientPatternService {
    private readonly baseUrl: string;
    private readonly logger: (level: "info" | "error", ...args: any[]) => void;

    constructor(baseUrl = "http://localhost:3001/api/patterns") {
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
    ): Promise<ServiceResponse<T>> {
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
                throw new Error(
                    responseData.error?.message ||
                        `HTTP error ${response.status}`
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
            throw error instanceof Error
                ? error
                : new Error("Unknown error occurred");
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

    async generatePattern(prompt: string): Promise<GeneratedPattern> {
        this.logger("info", "Generating pattern with prompt:", prompt);

        try {
            const response = await this.fetchWithLogging<GeneratedPattern>(
                "/generate",
                {
                    method: "POST",
                    body: JSON.stringify({ prompt }),
                }
            );

            if (!response.success || !response.data) {
                throw new PatternGenerationError(
                    response.error?.message || "Failed to generate pattern",
                    response.error?.details
                );
            }

            return response.data;
        } catch (error) {
            if (error instanceof PatternGenerationError) {
                throw error;
            }
            throw new PatternGenerationError(
                "Failed to generate pattern",
                error instanceof Error ? error.message : "Unknown error"
            );
        }
    }
}

// Create and export singleton instance
export const clientPatternService = new ClientPatternService();