import { readFileSync } from "fs";
import { loadServerConfig } from "../config/environment";
import {
    GeneratedPattern,
    PatternGenerationError,
    PatternServiceInterface,
    PatternValidationError,
} from "../../shared/types/pattern.types";

class ClaudeService implements PatternServiceInterface {
    private OPENROUTER_API_KEY: string;
    private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";
    private readonly PROMPT_TEMPLATE: string;

    constructor() {
        console.log("[ClaudeService] Initializing service...");

        try {
            // Load configuration
            const config = loadServerConfig();
            this.OPENROUTER_API_KEY = config.OPENROUTER_API_KEY;

            // Load prompt template
            console.log(
                "[ClaudeService] Loading prompt template from:",
                config.PROMPT_PATH
            );
            this.PROMPT_TEMPLATE = readFileSync(config.PROMPT_PATH, "utf-8");
            console.log("[ClaudeService] Successfully loaded prompt template");

            if (!this.OPENROUTER_API_KEY) {
                throw new PatternGenerationError(
                    "OpenRouter API key not found in configuration"
                );
            }

            console.log("[ClaudeService] Service initialized successfully");
        } catch (error) {
            console.error("[ClaudeService] Initialization failed:", error);
            throw new PatternGenerationError(
                "Failed to initialize ClaudeService",
                error instanceof Error ? error.message : error
            );
        }
    }

    private generatePrompt(userPrompt: string): string {
        console.log(
            "[ClaudeService] Generating prompt for user input:",
            userPrompt
        );
        try {
            const fullPrompt = this.PROMPT_TEMPLATE.replace(
                "{{user_prompt}}",
                userPrompt
            );
            console.log("[ClaudeService] Successfully generated full prompt");
            return fullPrompt;
        } catch (error) {
            console.error("[ClaudeService] Error generating prompt:", error);
            throw new PatternGenerationError(
                "Failed to generate prompt",
                error instanceof Error ? error.message : error
            );
        }
    }

    async generatePattern(userPrompt: string): Promise<GeneratedPattern> {
        console.log(
            "[ClaudeService] Starting pattern generation for prompt:",
            userPrompt
        );

        try {
            const requestBody = {
                model: "anthropic/claude-3.5-sonnet:beta",
                messages: [
                    {
                        role: "user",
                        content: this.generatePrompt(userPrompt),
                    },
                ],
            };
            console.log("[ClaudeService] Prepared request body");

            const response = await fetch(this.API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": "https://cursor.sh",
                    "X-Title": "Cursor",
                },
                body: JSON.stringify(requestBody),
            });

            console.log(
                "[ClaudeService] Received response status:",
                response.status
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[ClaudeService] API error response:", errorText);
                throw new PatternGenerationError(
                    `API request failed: ${response.statusText} (${response.status})`,
                    errorText
                );
            }

            const data = await response.json();
            console.log("[ClaudeService] Received raw API response");

            if (!data.choices?.[0]?.message?.content) {
                throw new PatternGenerationError(
                    "Invalid API response structure",
                    data
                );
            }

            let content = data.choices[0].message.content;
            console.log("[ClaudeService] Processing Claude's response");

            // Handle potential markdown formatting
            if (content.includes("```")) {
                console.log(
                    "[ClaudeService] Detected markdown code block, extracting JSON..."
                );
                content = content
                    .split("```")[1]
                    .replace(/^json\n/, "")
                    .trim();
            }

            // Parse the JSON response
            console.log("[ClaudeService] Parsing response as JSON");
            const fullResponse = JSON.parse(content);

            // Validate response structure
            const validationErrors: string[] = [];
            if (!fullResponse.plan) validationErrors.push("Missing plan");
            if (!fullResponse.title) validationErrors.push("Missing title");
            if (!fullResponse.html)
                validationErrors.push("Missing HTML content");
            if (!fullResponse.thumbnail)
                validationErrors.push("Missing thumbnail");

            if (validationErrors.length > 0) {
                throw new PatternValidationError(
                    "Response missing required fields",
                    validationErrors
                );
            }

            // Convert to expected format
            const pattern: GeneratedPattern = {
                plan: fullResponse.plan,
                title: fullResponse.title,
                description: fullResponse.description,
                html: fullResponse.html,
                thumbnail: {
                    alt: fullResponse.thumbnail.alt,
                    backgroundColor: fullResponse.thumbnail.backgroundColor,
                    elements: fullResponse.thumbnail.elements,
                },
            };

            console.log("[ClaudeService] Successfully generated pattern");
            return pattern;
        } catch (error) {
            console.error("[ClaudeService] Error in generatePattern:", error);
            if (
                error instanceof PatternGenerationError ||
                error instanceof PatternValidationError
            ) {
                throw error;
            }
            throw new PatternGenerationError(
                "Failed to generate pattern",
                error instanceof Error ? error.message : error
            );
        }
    }
}

export const claudeService = new ClaudeService();
