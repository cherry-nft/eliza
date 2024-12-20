import {
    GeneratedPattern,
    PatternGenerationError,
    PatternServiceInterface,
    PatternValidationError,
} from "../../shared/pattern.types";
import { VectorSupabase } from "../../../../src/services/VectorSupabase";
import { GamePattern } from "../../../../src/types/patterns";
import { ClaudeUsageContext } from "../../../../src/types/effectiveness";

interface ClaudeConfig {
    OPENROUTER_API_KEY: string;
    vectorDb: VectorSupabase;
}

export class ClaudeService implements PatternServiceInterface {
    private OPENROUTER_API_KEY: string;
    private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";
    private vectorDb: VectorSupabase;
    private lastUsedPatterns: GamePattern[] = []; // Properly typed array
    private readonly PROMPT_TEMPLATE = `# System Prompt: Artcade [In Production]

You are an expert web developer tasked with creating an interactive HTML experience. First, analyze this prompt and break it down into components:

"{{user_prompt}}"

Here are some similar patterns for reference:
{{pattern_examples}}

Your response must be a single JSON object with this exact structure. ALL fields are REQUIRED:

{
"plan": {
    "coreMechanics": string[],
    "visualElements": string[],
    "interactivity": string[],
    "interactionFlow": [
        {
            "trigger": string,
            "action": string,
            "description": string
        }
    ],
    "stateManagement": {
        "variables": [
            {
                "name": string,
                "type": string,
                "description": string
            }
        ],
        "updates": string[]
    },
    "assetRequirements": {
        "scripts": string[],
        "styles": string[],
        "fonts": string[],
        "images": string[],
        "animations": [
            {
                "type": string,
                "property": string,
                "element": string
            }
        ]
    }
},
"title": string,
"description": string,
"html": string,
"thumbnail": {
    "alt": string,
    "backgroundColor": string,
    "elements": [
        {
            "type": string,
            "attributes": Record<string, string | number>
        }
    ]
}
}

Requirements for the HTML:

- Must be a single, self-contained file
- All CSS in <style> tag in head
- All JavaScript in <script> tag at end of body
- Must use semantic HTML5 elements
- Must include proper meta tags
- Must be responsive (work down to 320px)
- Must include ARIA labels
- Must not use external resources

IMPORTANT VALIDATION REQUIREMENTS:

1. Response MUST be a single JSON object
2. ALL fields marked as REQUIRED must be present
3. The 'plan' object MUST include ALL specified fields
4. Do not include any explanation, markdown formatting, or additional text
5. The response must be valid JSON that can be parsed directly

Before returning, verify that your response includes ALL required fields and follows the exact structure specified above.`;

    constructor(config: ClaudeConfig) {
        console.log("[ClaudeService] Initializing service...");

        try {
            this.OPENROUTER_API_KEY = config.OPENROUTER_API_KEY;
            this.vectorDb = config.vectorDb;

            if (!this.OPENROUTER_API_KEY) {
                throw new PatternGenerationError(
                    "OpenRouter API key not found in configuration"
                );
            }

            if (!this.vectorDb) {
                throw new PatternGenerationError(
                    "Vector database not provided"
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

    private async findRelevantPatterns(prompt: string): Promise<GamePattern[]> {
        console.log(
            "[ClaudeService] Finding relevant patterns for prompt:",
            prompt
        );

        try {
            // Store the prompt embedding first
            await this.vectorDb.storePromptEmbedding({
                prompt,
                userId: "system",
                sessionId: crypto.randomUUID(),
                projectContext: "pattern_generation",
            });

            // Find similar patterns using the prompt directly
            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                prompt, // Pass prompt directly, VectorSupabase will handle embedding
                0.6, // similarity threshold
                3 // number of patterns to return
            );

            console.log(
                "[ClaudeService] Found similar patterns:",
                similarPatterns.map((p) => p.id)
            );

            // Store for later usage tracking
            this.lastUsedPatterns = similarPatterns;

            return similarPatterns;
        } catch (error) {
            console.error(
                "[ClaudeService] Error finding relevant patterns:",
                error
            );
            // Don't fail completely if pattern finding fails
            return [];
        }
    }

    private async generatePrompt(userPrompt: string): Promise<string> {
        console.log(
            "[ClaudeService] Generating prompt for user input:",
            userPrompt
        );
        try {
            // Find relevant patterns
            const relevantPatterns =
                await this.findRelevantPatterns(userPrompt);

            // Sort patterns by effectiveness score
            const sortedPatterns = relevantPatterns.sort(
                (a, b) => b.effectiveness_score - a.effectiveness_score
            );

            console.log(
                "[ClaudeService] Using patterns:",
                sortedPatterns.map((p) => ({
                    type: p.type,
                    score: p.effectiveness_score,
                    name: p.pattern_name,
                }))
            );

            // Include patterns in prompt
            const enhancedPrompt = this.PROMPT_TEMPLATE.replace(
                "{{user_prompt}}",
                userPrompt
            ).replace(
                "{{pattern_examples}}",
                this.formatPatternExamples(sortedPatterns)
            );

            console.log(
                "[ClaudeService] Successfully generated enhanced prompt"
            );
            return enhancedPrompt;
        } catch (error) {
            console.error("[ClaudeService] Error generating prompt:", error);
            // Fallback to basic prompt if pattern enhancement fails
            return this.PROMPT_TEMPLATE.replace(
                "{{user_prompt}}",
                userPrompt
            ).replace("{{pattern_examples}}", "No relevant patterns found.");
        }
    }

    private formatPatternExamples(patterns: GamePattern[]): string {
        return patterns
            .map(
                (pattern) => `
            Here's a highly effective ${pattern.type} pattern (score: ${pattern.effectiveness_score}):
            \`\`\`html
            ${pattern.content.html}
            \`\`\`
            ${pattern.content.css ? `\`\`\`css\n${pattern.content.css}\n\`\`\`` : ""}
            ${pattern.content.js ? `\`\`\`javascript\n${pattern.content.js}\n\`\`\`` : ""}
        `
            )
            .join("\n\n");
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

    private sanitizeJsonString(str: string): string {
        // Remove any invalid escape sequences
        return (
            str
                .replace(/\\([^"\\\/bfnrtu])/g, "$1")
                // Ensure all backslashes are properly escaped
                .replace(/\\/g, "\\\\")
                // Fix any unescaped quotes
                .replace(/(?<!\\)"/g, '\\"')
                // Remove any control characters
                .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        );
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
                        content: await this.generatePrompt(userPrompt),
                    },
                ],
                max_tokens: 8192,
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
                signal: AbortSignal.timeout(60000),
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
            console.log("[ClaudeService] Processing Claude's response");
            console.log("[ClaudeService] Raw response:", content);

            let pattern: GeneratedPattern;
            try {
                // First try parsing the raw response
                pattern = JSON.parse(content);
                console.log(
                    "[ClaudeService] Successfully parsed JSON response"
                );
            } catch (initialError) {
                console.log(
                    "[ClaudeService] Initial parse failed, attempting to sanitize"
                );

                try {
                    // If raw parsing fails, try sanitizing the response
                    const sanitizedContent = this.sanitizeJsonString(content);
                    console.log(
                        "[ClaudeService] Sanitized content:",
                        sanitizedContent
                    );

                    pattern = JSON.parse(sanitizedContent);
                    console.log(
                        "[ClaudeService] Successfully parsed sanitized JSON response"
                    );
                } catch (error) {
                    console.error(
                        "[ClaudeService] Failed to parse sanitized response:",
                        error
                    );
                    throw new PatternValidationError(
                        "Invalid response format from Claude",
                        [error instanceof Error ? error.message : String(error)]
                    );
                }
            }

            // Track pattern usage if we used any patterns for generation
            if (this.lastUsedPatterns.length > 0) {
                console.log("[ClaudeService] Tracking pattern usage");
                try {
                    await this.vectorDb.trackClaudeUsage({
                        prompt: userPrompt,
                        generated_html: pattern.html,
                        similarity_score: 0.9,
                        matched_patterns: this.lastUsedPatterns.map((p) => ({
                            pattern_id: p.id,
                            similarity: 0.9,
                            features_used: [],
                        })),
                        quality_assessment: {
                            visual: 0.9,
                            interactive: 0.9,
                            functional: 0.9,
                            performance: 0.9,
                        },
                    });
                    console.log(
                        "[ClaudeService] Successfully tracked pattern usage"
                    );
                } catch (error) {
                    console.error(
                        "[ClaudeService] Failed to track pattern usage:",
                        error
                    );
                    // Don't fail the generation if tracking fails
                }
            }

            return pattern;
        } catch (error) {
            console.error("[ClaudeService] Pattern generation failed:", error);
            throw error;
        }
    }
}
