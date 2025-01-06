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

interface PatternUsageCheck {
    patternId: string;
    patternName: string;
    snippetsFound: {
        snippet: string;
        type: "html" | "css" | "js";
        context: string;
    }[];
    totalSnippets: number;
    usagePercentage: number;
}

export class ClaudeService implements PatternServiceInterface {
    private OPENROUTER_API_KEY: string;
    private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";
    private vectorDb: VectorSupabase;
    private lastUsedPatterns: GamePattern[] = []; // Properly typed array
    private readonly PROMPT_TEMPLATE = `# System Prompt: Artcade [In Production]

You are an expert web developer tasked with creating an interactive HTML experience. Your PRIMARY DIRECTIVE is to EXACTLY COPY the provided game mechanics code, only making minimal necessary adjustments. First, analyze this prompt:

"{{user_prompt}}"

CRITICAL INSTRUCTION - PATTERN REUSE:
1. You MUST copy the complete function implementations from the provided patterns
2. DO NOT rewrite or simplify the mechanics - use them exactly as provided
3. Only rename variables if absolutely necessary for integration
4. Preserve all helper functions and state variables
5. Maintain the exact same logic flow and complexity

Here are the patterns you MUST incorporate:
{{pattern_examples}}

VALIDATION REQUIREMENTS:
1. Your implementation MUST include all functions from game_mechanic patterns
2. Function bodies should match the patterns with minimal changes
3. State machines and complex logic must be preserved
4. All helper functions must be included

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
                similarPatterns.map((p) => p.pattern.id)
            );

            // Store for later usage tracking
            this.lastUsedPatterns = similarPatterns.map((p) => p.pattern);

            return similarPatterns.map((p) => p.pattern);
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
        // Sort game mechanics first
        const sortedPatterns = [...patterns].sort((a, b) =>
            a.type === "game_mechanic" ? -1 : b.type === "game_mechanic" ? 1 : 0
        );

        return sortedPatterns
            .map(
                (pattern) => `
            ${pattern.type === "game_mechanic" ? "!!! CRITICAL GAME MECHANIC - YOU MUST USE THIS CODE !!!" : "Supporting Pattern"}
            Pattern: ${pattern.pattern_name} (${pattern.type})
            Effectiveness Score: ${pattern.effectiveness_score}

            Core Functionality to Preserve:
            ${
                pattern.content.js
                    ? `
            JavaScript (COPY THIS EXACTLY):
            \`\`\`javascript
            ${pattern.content.js}
            \`\`\`
            `
                    : ""
            }

            Required Structure:
            \`\`\`html
            ${pattern.content.html}
            \`\`\`

            ${
                pattern.content.css
                    ? `
            Essential Styling:
            \`\`\`css
            ${pattern.content.css}
            \`\`\`
            `
                    : ""
            }

            Integration Requirements:
            1. Copy and adapt the core mechanics code
            2. Preserve the physics and collision detection logic
            3. Maintain the same function signatures
            4. Only modify variable names if absolutely necessary
            `
            )
            .join("\n\n=== NEXT PATTERN ===\n\n");
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

    private getDistinctiveSnippets(
        pattern: GamePattern
    ): { snippet: string; type: "html" | "css" | "js"; context: string }[] {
        const snippets: {
            snippet: string;
            type: "html" | "css" | "js";
            context: string;
        }[] = [];

        if (pattern.content.js) {
            // First, normalize the code by removing whitespace and formatting variations
            const normalizedJs = pattern.content.js
                .replace(/\s+/g, " ") // Normalize whitespace
                .replace(/([{};,])\s*/g, "$1") // Remove space after punctuation
                .replace(/\s*([{};,])/g, "$1") // Remove space before punctuation
                .trim();

            // Extract core game mechanics (collisionDetection, moveAIPaddle, etc.)
            const mechanicsRegex =
                /function\s+(collisionDetection|moveAIPaddle|isPuckStuck|resetPuck)\s*\([^{]*\{[^}]*\}/g;
            let match;
            while ((match = mechanicsRegex.exec(normalizedJs)) !== null) {
                const [fullMatch, funcName] = match;
                snippets.push({
                    type: "js",
                    snippet: fullMatch,
                    context: `Core mechanic: ${funcName}`,
                });
            }

            // Extract state variables and their initialization
            const stateRegex =
                /(?:let|const|var)\s+(puck|paddle|aiPaddle|goal|simulationSpeedMultiplier|aiState|aiWaitTime|puckStuckTime)\s*=/g;
            while ((match = stateRegex.exec(normalizedJs)) !== null) {
                const [fullMatch, varName] = match;
                // Find the full variable declaration
                const endIndex = normalizedJs.indexOf(";", match.index);
                if (endIndex !== -1) {
                    snippets.push({
                        type: "js",
                        snippet: normalizedJs.slice(match.index, endIndex + 1),
                        context: `State variable: ${varName}`,
                    });
                }
            }

            // Extract core game loop structure
            const gameLoopRegex =
                /function\s+(?:gameLoop|update)\s*\([^{]*\{[^}]*requestAnimationFrame[^}]*\}/g;
            while ((match = gameLoopRegex.exec(normalizedJs)) !== null) {
                snippets.push({
                    type: "js",
                    snippet: match[0],
                    context: "Game loop structure",
                });
            }

            // Extract physics calculations
            const physicsRegex =
                /(?:Math\.(?:hypot|atan2|cos|sin|min|max|abs)\([^)]+\))/g;
            while ((match = physicsRegex.exec(normalizedJs)) !== null) {
                snippets.push({
                    type: "js",
                    snippet: match[0],
                    context: "Physics calculation",
                });
            }
        }

        if (pattern.content.css) {
            // Look for custom animations
            const animationMatches = pattern.content.css.match(
                /@keyframes\s+([a-zA-Z-_0-9]+)\s*{/g
            );
            if (animationMatches) {
                animationMatches.forEach((anim) => {
                    snippets.push({
                        type: "css",
                        snippet: anim.trim(),
                        context: "Keyframe animation",
                    });
                });
            }

            // Look for complex selectors
            const selectorMatches = pattern.content.css.match(
                /\.[a-zA-Z-_0-9]+\s*[+~>]\s*\.[a-zA-Z-_0-9]+/g
            );
            if (selectorMatches) {
                selectorMatches.forEach((selector) => {
                    snippets.push({
                        type: "css",
                        snippet: selector.trim(),
                        context: "Complex selector",
                    });
                });
            }
        }

        if (pattern.content.html) {
            // Look for custom data attributes
            const dataAttrMatches = pattern.content.html.match(
                /data-[a-zA-Z-_0-9]+="[^"]+"/g
            );
            if (dataAttrMatches) {
                dataAttrMatches.forEach((attr) => {
                    snippets.push({
                        type: "html",
                        snippet: attr.trim(),
                        context: "Data attribute",
                    });
                });
            }

            // Look for specific class combinations
            const classMatches = pattern.content.html.match(/class="([^"]+)"/g);
            if (classMatches) {
                classMatches.forEach((classes) => {
                    if (classes.split(/\s+/).length > 2) {
                        snippets.push({
                            type: "html",
                            snippet: classes.trim(),
                            context: "Class combination",
                        });
                    }
                });
            }
        }

        return snippets;
    }

    private checkPatternUsage(response: GeneratedPattern): PatternUsageCheck[] {
        const checks = this.lastUsedPatterns.map((pattern) => {
            const snippets = this.getDistinctiveSnippets(pattern);
            const foundSnippets = snippets.filter((s) =>
                response.html.includes(s.snippet)
            );

            return {
                patternId: pattern.id,
                patternName: pattern.pattern_name,
                snippetsFound: foundSnippets,
                totalSnippets: snippets.length,
                usagePercentage:
                    snippets.length > 0
                        ? (foundSnippets.length / snippets.length) * 100
                        : 0,
            };
        });

        // Log detailed usage information
        console.log("\n[ClaudeService] Pattern Usage Analysis:");
        checks.forEach((check) => {
            console.log(`\nPattern: ${check.patternName} (${check.patternId})`);
            console.log(
                `Usage: ${check.usagePercentage.toFixed(1)}% (${check.snippetsFound.length}/${check.totalSnippets} snippets)`
            );
            if (check.snippetsFound.length > 0) {
                console.log("Found snippets:");
                check.snippetsFound.forEach((s) => {
                    console.log(
                        `- ${s.type.toUpperCase()}: ${s.context}\n  "${s.snippet}"`
                    );
                });
            }
        });

        return checks;
    }

    async generatePattern(userPrompt: string): Promise<GeneratedPattern> {
        try {
            console.log(
                "[ClaudeService] Starting pattern generation for prompt:",
                userPrompt
            );

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
                console.error(
                    "[ClaudeService] Invalid response structure:",
                    JSON.stringify(data, null, 2)
                );
                throw new PatternGenerationError(
                    "Invalid API response format - missing content"
                );
            }

            const content = data.choices[0].message.content;
            console.log("[ClaudeService] Raw content length:", content.length);
            console.log("[ClaudeService] Processing Claude's response");
            console.log("[ClaudeService] Raw response:", content);

            let pattern: GeneratedPattern;
            try {
                // Try to clean the content before parsing
                const cleanContent = content.trim();
                console.log(
                    "[ClaudeService] Attempting to parse content:",
                    cleanContent.substring(0, 200) + "..."
                );

                pattern = JSON.parse(cleanContent);
                console.log(
                    "[ClaudeService] Successfully parsed JSON response"
                );
            } catch (error) {
                console.error(
                    "[ClaudeService] Failed to parse response:",
                    error
                );
                console.error("[ClaudeService] Full content:", content);
                throw new PatternValidationError(
                    "Invalid response format from Claude",
                    [error instanceof Error ? error.message : String(error)]
                );
            }

            // Check pattern usage
            const usageChecks = this.checkPatternUsage(pattern);

            // If no patterns were used significantly, log a warning
            const significantUsage = usageChecks.some(
                (check) => check.usagePercentage >= 30
            );
            if (!significantUsage) {
                console.warn(
                    "[ClaudeService] WARNING: Generated pattern shows low reuse of existing patterns"
                );
                console.warn(
                    "Consider adjusting the prompt to encourage more pattern reuse"
                );
            }

            // Track pattern usage if we used any patterns
            if (this.lastUsedPatterns.length > 0) {
                console.log("[ClaudeService] Tracking pattern usage");
                try {
                    await this.vectorDb.trackClaudeUsage({
                        prompt: userPrompt,
                        generated_html: pattern.html,
                        similarity_score: significantUsage ? 0.9 : 0.5,
                        matched_patterns: usageChecks.map((check) => ({
                            pattern_id: check.patternId,
                            similarity: check.usagePercentage / 100,
                            features_used: check.snippetsFound.map(
                                (s) => s.snippet
                            ),
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
                }
            }

            return pattern;
        } catch (error) {
            console.error("[ClaudeService] Pattern generation failed:", error);
            throw error;
        }
    }
}
