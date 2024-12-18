import { readFileSync } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { PatternGenerationError } from "../shared/types/pattern.types";
import { SERVER_CONFIG } from "../server/config/serverConfig";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ClaudeResponse {
    plan: {
        coreMechanics: string[];
        visualElements: string[];
        interactionFlow: string[];
        stateManagement: string[];
        assetRequirements: string[];
    };
    title: string;
    description: string;
    html: string;
    thumbnail: {
        alt: string;
        backgroundColor: string;
        elements: Array<{
            type: "rect" | "circle" | "path";
            attributes: Record<string, string>;
        }>;
    };
}

class ClaudeService {
    private readonly API_KEY: string;
    private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";
    private readonly PROMPT_TEMPLATE: string;

    constructor() {
        console.log("[ClaudeService] Initializing service...");

        try {
            this.API_KEY = SERVER_CONFIG.OPENROUTER_API_KEY;

            if (!this.API_KEY) {
                console.error(
                    "[ClaudeService] No OpenRouter API key found in server config"
                );
                throw new Error(
                    "OpenRouter API key not found in server config"
                );
            }

            // Load prompt template
            const promptPath = path.resolve(
                __dirname,
                "../public/artcade-prompt.md"
            );
            console.log(
                "[ClaudeService] Loading prompt template from:",
                promptPath
            );

            try {
                this.PROMPT_TEMPLATE = readFileSync(promptPath, "utf-8");
                console.log(
                    "[ClaudeService] Successfully loaded prompt template"
                );
            } catch (error) {
                console.error(
                    "[ClaudeService] Error loading prompt template:",
                    error
                );
                throw new Error("Failed to load prompt template");
            }

            console.log("[ClaudeService] Service initialized successfully");
        } catch (error) {
            console.error("[ClaudeService] Initialization failed:", error);
            throw error;
        }
    }

    async generatePattern(userPrompt: string): Promise<ClaudeResponse> {
        console.log(
            "[ClaudeService] Generating pattern for prompt:",
            userPrompt
        );

        try {
            console.log("[ClaudeService] Making request to OpenRouter API...");
            const requestBody = {
                model: "anthropic/claude-3.5-sonnet:beta",
                messages: [
                    {
                        role: "user",
                        content: this.PROMPT_TEMPLATE.replace(
                            "{{user_prompt}}",
                            userPrompt
                        ),
                    },
                ],
            };
            console.log(
                "[ClaudeService] Request body:",
                JSON.stringify(requestBody, null, 2)
            );

            const response = await fetch(this.API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.API_KEY}`,
                    "HTTP-Referer": "https://cursor.sh",
                    "X-Title": "Cursor",
                },
                body: JSON.stringify(requestBody),
            });

            console.log("[ClaudeService] Response status:", response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error("[ClaudeService] API error response:", errorText);
                throw new Error(
                    `API request failed: ${response.statusText} (${response.status})\n${errorText}`
                );
            }

            const data = await response.json();
            console.log(
                "[ClaudeService] Raw API response:",
                JSON.stringify(data, null, 2)
            );

            if (!data.choices?.[0]?.message?.content) {
                console.error(
                    "[ClaudeService] Invalid API response structure:",
                    data
                );
                throw new Error("Invalid API response structure");
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
            try {
                console.log("[ClaudeService] Parsing response as JSON");
                const fullResponse = JSON.parse(content);

                // Validate response structure
                if (
                    !fullResponse.plan ||
                    !fullResponse.title ||
                    !fullResponse.html ||
                    !fullResponse.thumbnail
                ) {
                    console.error(
                        "[ClaudeService] Missing required fields in response:",
                        fullResponse
                    );
                    throw new Error("Response missing required fields");
                }

                // Convert to expected format
                const pattern: ClaudeResponse = {
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
            } catch (error: unknown) {
                console.error(
                    "[ClaudeService] Failed to parse Claude response:",
                    error
                );
                console.error("[ClaudeService] Response content:", content);
                throw new Error(
                    `Invalid response format from Claude: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        } catch (error) {
            console.error("[ClaudeService] Error in generatePattern:", error);
            throw error;
        }
    }
}

// Export the singleton instance
export const claudeService = new ClaudeService();
