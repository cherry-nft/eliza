import { JSDOM } from "jsdom";
import { GamePattern, PatternMetadata } from "../types/patterns";
import crypto from "crypto";

interface ExtractedPattern {
    type: "layout" | "interaction" | "animation" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: PatternMetadata;
    };
}

interface ExtractionConfig {
    types: {
        layout?: boolean;
        interaction?: boolean;
        animation?: boolean;
        style?: boolean;
        game_mechanic?: boolean;
    };
    description: string;
}

export class PatternExtractor {
    /**
     * Extract patterns from an HTML file based on specified types
     */
    static async extractPatterns(
        htmlContent: string,
        config: ExtractionConfig
    ): Promise<GamePattern[]> {
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;

        // Get all styles (both <style> tags and linked stylesheets)
        const styles = Array.from(document.querySelectorAll("style"))
            .map((style) => style.textContent || "")
            .join("\n");

        // Get all scripts
        const scripts = Array.from(document.querySelectorAll("script"))
            .map((script) => script.textContent || "")
            .join("\n");

        const patterns: ExtractedPattern[] = [];

        // Extract patterns based on config.types
        if (config.types.layout) {
            patterns.push(...this.extractLayoutPatterns(document, styles));
        }
        if (config.types.interaction) {
            patterns.push(
                ...this.extractInteractionPatterns(document, scripts)
            );
        }
        if (config.types.animation) {
            patterns.push(
                ...this.extractAnimationPatterns(document, styles, scripts)
            );
        }
        if (config.types.style) {
            patterns.push(...this.extractStylePatterns(document, styles));
        }
        if (config.types.game_mechanic) {
            patterns.push(
                ...this.extractGameMechanicPatterns(document, scripts)
            );
        }

        // Convert to GamePattern format
        return patterns.map((pattern) => ({
            id: crypto.randomUUID(),
            type: pattern.type,
            pattern_name: pattern.pattern_name,
            user_id: "pattern-extractor",
            agent_id: "pattern-extractor",
            content: {
                html: pattern.content.html,
                css: pattern.content.css || "",
                js: pattern.content.js || "",
                context: pattern.content.context,
                metadata: pattern.content.metadata,
            },
            room_id: `extracted_${pattern.type}_${Date.now()}`,
            effectiveness_score: 1.0, // Start with perfect score since these are curated
            usage_count: 0, // Initialize with 0 uses
            created_at: new Date(),
            last_used: new Date(),
            usage_stats: {
                total_uses: 0,
                successful_uses: 0,
                average_similarity: 1.0,
                last_used: new Date(),
            },
        }));
    }

    private static extractLayoutPatterns(
        document: Document,
        styles: string
    ): ExtractedPattern[] {
        const patterns: ExtractedPattern[] = [];

        // Look for grid/flex containers
        const gridContainers = document.querySelectorAll(
            '[class*="grid"], [class*="flex"]'
        );
        gridContainers.forEach((container) => {
            // Get the container and its immediate children
            const html = container.outerHTML;

            // Extract relevant CSS
            const className = container.className;
            const cssRegex = new RegExp(
                `[.](${className.split(" ").join("|")})\\s*{[^}]*}`,
                "g"
            );
            const css = (styles.match(cssRegex) || []).join("\n");

            if (css.includes("grid") || css.includes("flex")) {
                patterns.push({
                    type: "layout",
                    pattern_name: `${className} Layout Pattern`,
                    content: {
                        html,
                        css,
                        js: "",
                        context:
                            "Responsive layout pattern using CSS Grid/Flexbox",
                        metadata: {
                            description: `A responsive ${css.includes("grid") ? "grid" : "flex"} layout pattern`,
                            visual_type: css.includes("grid") ? "grid" : "flex",
                            semantic_tags: {
                                use_cases: ["layout", "responsive"],
                                mechanics: [],
                                interactions: [],
                                visual_style: ["grid", "flex", "responsive"],
                            },
                        },
                    },
                });
            }
        });

        return patterns;
    }

    private static extractInteractionPatterns(
        document: Document,
        scripts: string
    ): ExtractedPattern[] {
        const patterns: ExtractedPattern[] = [];

        // Look for elements with event listeners in the JS
        const interactiveElements = document.querySelectorAll(
            'button, [role="button"], input, select, [tabindex], [class*="click"], [class*="hover"]'
        );

        interactiveElements.forEach((element) => {
            const html = element.outerHTML;

            // Find related JS by looking for selectors or IDs
            const id = element.id;
            const classes = Array.from(element.classList);
            const jsRegex = new RegExp(
                `(addEventListener|on(?:click|mouseover|focus)).*?(${id}|${classes.join("|")})`,
                "g"
            );
            const js = (scripts.match(jsRegex) || []).join("\n");

            if (js) {
                const events =
                    js.match(/on(click|mouseover|focus|blur|change)/g) || [];
                patterns.push({
                    type: "interaction",
                    pattern_name: `${id || classes[0]} Interaction Pattern`,
                    content: {
                        html,
                        css: "",
                        js,
                        context: "Interactive element with event handling",
                        metadata: {
                            description: `Interactive ${element.tagName.toLowerCase()} with ${events.join(", ")} events`,
                            interaction_type: "event-based",
                            semantic_tags: {
                                use_cases: ["interaction", "user-input"],
                                mechanics: [],
                                interactions: events.map((e) =>
                                    e.replace("on", "")
                                ),
                                visual_style: [],
                            },
                        },
                    },
                });
            }
        });

        return patterns;
    }

    private static extractAnimationPatterns(
        document: Document,
        styles: string,
        scripts: string
    ): ExtractedPattern[] {
        const patterns: ExtractedPattern[] = [];

        // Look for CSS animations
        const animationRegex = /@keyframes\s+([^\s{]+)\s*{[^}]*}/g;
        let match;
        while ((match = animationRegex.exec(styles)) !== null) {
            const [fullMatch, animationName] = match;

            // Find elements using this animation
            const elements = document.querySelectorAll(
                `[class*="animate"], [class*="${animationName}"]`
            );

            if (elements.length > 0) {
                patterns.push({
                    type: "animation",
                    pattern_name: `${animationName} Animation Pattern`,
                    content: {
                        html: elements[0].outerHTML,
                        css: fullMatch,
                        js: "",
                        context: "CSS Keyframe animation pattern",
                        metadata: {
                            description: `CSS keyframe animation named ${animationName}`,
                            animation_duration: "1s", // Default duration
                            semantic_tags: {
                                use_cases: ["animation", "visual-feedback"],
                                mechanics: [],
                                interactions: [],
                                visual_style: ["animated", "keyframes"],
                            },
                        },
                    },
                });
            }
        }

        // Look for JS animations (requestAnimationFrame)
        const rafRegex = /requestAnimationFrame|animate|transition/g;
        if (rafRegex.test(scripts)) {
            const animatedElements = document.querySelectorAll(
                '[class*="animate"], [class*="transition"]'
            );

            if (animatedElements.length > 0) {
                patterns.push({
                    type: "animation",
                    pattern_name: "JavaScript Animation Pattern",
                    content: {
                        html: animatedElements[0].outerHTML,
                        css: "",
                        js:
                            scripts
                                .match(
                                    /function\s+\w*(?:animate|update|transition)\w*\s*\([^{]*\{[^}]*\}/g
                                )
                                ?.join("\n") || "",
                        context:
                            "JavaScript-based animation using requestAnimationFrame",
                        metadata: {
                            description:
                                "JavaScript animation using requestAnimationFrame",
                            animation_duration: "continuous",
                            semantic_tags: {
                                use_cases: ["animation", "continuous-update"],
                                mechanics: ["requestAnimationFrame"],
                                interactions: [],
                                visual_style: ["animated", "dynamic"],
                            },
                        },
                    },
                });
            }
        }

        return patterns;
    }

    private static extractStylePatterns(
        document: Document,
        styles: string
    ): ExtractedPattern[] {
        const patterns: ExtractedPattern[] = [];

        // Look for consistent style patterns (color schemes, typography, etc)
        const stylePatterns = {
            colors: /#[a-f0-9]{3,6}|rgb\(.*?\)|rgba\(.*?\)|var\(--[^)]+\)/g,
            typography: /font-family|font-size|line-height|letter-spacing/g,
            spacing: /margin|padding|gap/g,
            effects: /box-shadow|text-shadow|filter|backdrop-filter/g,
        };

        for (const [type, regex] of Object.entries(stylePatterns)) {
            const matches = styles.match(regex);
            if (matches && matches.length > 0) {
                // Find elements using these styles
                const elements = document.querySelectorAll(
                    '[class*="color"], [class*="theme"], [class*="style"]'
                );

                if (elements.length > 0) {
                    patterns.push({
                        type: "style",
                        pattern_name: `${type.charAt(0).toUpperCase() + type.slice(1)} Style Pattern`,
                        content: {
                            html: elements[0].outerHTML,
                            css: matches.join("\n"),
                            js: "",
                            context: `Consistent ${type} styling pattern`,
                            metadata: {
                                description: `Consistent ${type} styling pattern with ${matches.length} rules`,
                                visual_type: type,
                                color_scheme:
                                    type === "colors" ? matches : undefined,
                                semantic_tags: {
                                    use_cases: ["styling", type],
                                    mechanics: [],
                                    interactions: [],
                                    visual_style: [type],
                                },
                            },
                        },
                    });
                }
            }
        }

        return patterns;
    }

    private static extractGameMechanicPatterns(
        document: Document,
        scripts: string
    ): ExtractedPattern[] {
        const patterns: ExtractedPattern[] = [];

        // Look for game-related code patterns
        const gamePatterns = {
            physics: /velocity|acceleration|gravity|collision/g,
            input: /keydown|keyup|mousedown|mouseup|mousemove/g,
            gameLoop: /requestAnimationFrame|setInterval|loop|update|tick/g,
            state: /score|lives|health|points|level/g,
        };

        for (const [type, regex] of Object.entries(gamePatterns)) {
            const matches = scripts.match(regex);
            if (matches && matches.length > 0) {
                // Find related game elements
                const elements = document.querySelectorAll(
                    '[class*="game"], [class*="player"], [class*="score"]'
                );

                if (elements.length > 0) {
                    patterns.push({
                        type: "game_mechanic",
                        pattern_name: `${type.charAt(0).toUpperCase() + type.slice(1)} Game Mechanic`,
                        content: {
                            html: elements[0].outerHTML,
                            css: "",
                            js:
                                scripts
                                    .match(
                                        new RegExp(
                                            `function\\s+\\w*(?:${type})\\w*\\s*\\([^{]*\\{[^}]*\\}`,
                                            "g"
                                        )
                                    )
                                    ?.join("\n") || "",
                            context: `Game mechanic pattern for ${type}`,
                            metadata: {
                                description: `Game mechanic implementation for ${type}`,
                                game_mechanics: [
                                    {
                                        type,
                                        properties: {
                                            features: matches,
                                        },
                                    },
                                ],
                                semantic_tags: {
                                    use_cases: ["game", type],
                                    mechanics: matches,
                                    interactions: [],
                                    visual_style: [],
                                },
                            },
                        },
                    });
                }
            }
        }

        return patterns;
    }
}
