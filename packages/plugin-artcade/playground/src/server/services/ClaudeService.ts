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

    private extractPlanningInfo(content: string) {
        console.log("[ClaudeService] Extracting planning information");
        const planningMatch = content.match(
            /<experience_planning>([\s\S]*?)<\/experience_planning>/
        );

        if (!planningMatch) {
            console.error("[ClaudeService] No planning information found");
            return null;
        }

        const planningText = planningMatch[1];
        console.log("[ClaudeService] Found planning text:", planningText);

        // Extract core mechanics from Key Components section
        const mechanics =
            planningText
                .match(/Key Components:[\s\S]*?(?=\n\d\.|\n$)/i)?.[0]
                ?.split("\n")
                .filter((line) => line.trim().startsWith("-"))
                .map((line) => line.replace("-", "").trim()) || [];

        // Extract visual elements from HTML Structure section
        const visuals =
            planningText
                .match(/HTML Structure:[\s\S]*?(?=\n\d\.|\n$)/i)?.[0]
                ?.split("\n")
                .filter((line) => line.trim().startsWith("-"))
                .map((line) => line.replace("-", "").trim()) || [];

        // Extract interactivity from JavaScript Functions section
        const interactivity =
            planningText
                .match(/JavaScript Functions:[\s\S]*?(?=\n\d\.|\n$)/i)?.[0]
                ?.split("\n")
                .filter((line) => line.trim().startsWith("-"))
                .map((line) => line.replace("-", "").trim()) || [];

        // Derive interaction flow from the JavaScript functions
        const interactionFlow = interactivity.map((func) => {
            const funcName = func.split(":")[0]?.trim() || func;
            return {
                trigger: funcName.includes("handle") ? "event" : "automatic",
                action: funcName,
                description: func,
            };
        });

        // Extract state management from the planning
        const stateManagement = {
            variables: [
                {
                    name: "position",
                    type: "vector",
                    description: "Ball position (x, y)",
                },
                {
                    name: "velocity",
                    type: "vector",
                    description: "Ball velocity (dx, dy)",
                },
                {
                    name: "physics",
                    type: "constants",
                    description: "Physics parameters (gravity, damping)",
                },
            ],
            updates: [
                "Position updated each animation frame",
                "Velocity modified by gravity and collisions",
                "State reset on user interaction",
            ],
        };

        // Define asset requirements based on the implementation
        const assetRequirements = {
            scripts: [],
            styles: [],
            fonts: ["system-ui", "-apple-system", "sans-serif"],
            images: [],
            animations: [
                { type: "css", property: "background-color", element: "ball" },
                { type: "js", property: "transform", element: "ball" },
            ],
        };

        console.log("[ClaudeService] Extracted plan components:", {
            mechanics,
            visuals,
            interactivity,
            interactionFlow,
            stateManagement,
            assetRequirements,
        });

        return {
            coreMechanics: mechanics,
            visualElements: visuals,
            interactivity: interactivity,
            interactionFlow: interactionFlow,
            stateManagement: stateManagement,
            assetRequirements: assetRequirements,
        };
    }

    private convertSvgToElements(svgString: string) {
        console.log("[ClaudeService] Converting SVG string to elements");

        // Extract elements from SVG string
        const elements: Array<{
            type: string;
            attributes: Record<string, string | number>;
        }> = [];

        // Match all SVG elements (rect, circle, path, etc.)
        const elementRegex =
            /<(rect|circle|path|line|polygon|polyline)\s+([^>]*)\/>/g;
        let match;

        while ((match = elementRegex.exec(svgString)) !== null) {
            const [_, type, attributesString] = match;
            const attributes: Record<string, string | number> = {};

            // Extract attributes
            const attrRegex = /(\w+)="([^"]*)"/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
                const [__, name, value] = attrMatch;
                // Convert numeric values
                attributes[name] = /^-?\d+\.?\d*$/.test(value)
                    ? parseFloat(value)
                    : value;
            }

            elements.push({ type, attributes });
        }

        console.log("[ClaudeService] Converted elements:", elements);
        return elements;
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
                max_tokens: 4096,
                temperature: 0.7,
                top_p: 1,
                stream: false,
            };
            console.log(
                "[ClaudeService] Prepared request body with max tokens"
            );

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
                console.error("[ClaudeService] API error:", errorText);
                throw new PatternGenerationError(
                    "API request failed",
                    errorText
                );
            }

            const data = await response.json();
            console.log("[ClaudeService] Received response data");

            if (!data.choices?.[0]?.message?.content) {
                throw new PatternGenerationError("Invalid API response format");
            }

            const content = data.choices[0].message.content;
            console.log("[ClaudeService] Parsing response content");

            try {
                // Parse the JSON response directly
                const pattern = JSON.parse(content);
                console.log(
                    "[ClaudeService] Successfully parsed JSON response"
                );

                // Validate required fields with detailed logging
                const missingFields = [];
                if (!pattern.plan) missingFields.push("plan");
                if (!pattern.html) missingFields.push("html");
                if (!pattern.title) missingFields.push("title");
                if (!pattern.description) missingFields.push("description");

                if (missingFields.length > 0) {
                    console.error(
                        "[ClaudeService] Missing required fields:",
                        missingFields
                    );
                    console.log(
                        "[ClaudeService] Received pattern structure:",
                        Object.keys(pattern)
                    );
                    throw new PatternValidationError(
                        "Response missing required fields: " +
                            missingFields.join(", "),
                        { missingFields, receivedFields: Object.keys(pattern) }
                    );
                }

                // Additional plan validation
                if (pattern.plan) {
                    const missingPlanFields = [];
                    if (!pattern.plan.coreMechanics)
                        missingPlanFields.push("plan.coreMechanics");
                    if (!pattern.plan.visualElements)
                        missingPlanFields.push("plan.visualElements");
                    if (!pattern.plan.interactivity)
                        missingPlanFields.push("plan.interactivity");
                    if (!pattern.plan.interactionFlow)
                        missingPlanFields.push("plan.interactionFlow");
                    if (!pattern.plan.stateManagement)
                        missingPlanFields.push("plan.stateManagement");
                    if (!pattern.plan.assetRequirements)
                        missingPlanFields.push("plan.assetRequirements");

                    if (missingPlanFields.length > 0) {
                        console.error(
                            "[ClaudeService] Missing plan fields:",
                            missingPlanFields
                        );
                        throw new PatternValidationError(
                            "Response missing required plan fields: " +
                                missingPlanFields.join(", "),
                            {
                                missingPlanFields,
                                receivedPlanFields: Object.keys(pattern.plan),
                            }
                        );
                    }
                }

                console.log(
                    "[ClaudeService] All required fields validated successfully"
                );
                return pattern;
            } catch (error) {
                console.error(
                    "[ClaudeService] Failed to parse or validate response:",
                    error
                );
                if (error instanceof PatternValidationError) {
                    throw error;
                }
                throw new PatternValidationError(
                    "Invalid response format from Claude",
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        content,
                    }
                );
            }
        } catch (error) {
            console.error("[ClaudeService] Pattern generation failed:", error);
            if (
                error instanceof PatternValidationError ||
                error instanceof PatternGenerationError
            ) {
                throw error;
            }
            throw new PatternGenerationError(
                "Failed to generate pattern",
                error instanceof Error ? error.message : String(error)
            );
        }
    }
}

export const claudeService = new ClaudeService();
