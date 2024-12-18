import { GamePattern } from "../../../src/types/patterns";
import { PatternEffectivenessMetrics } from "../../../src/types/effectiveness";
import { claudeService } from "./ClaudeService";

class PlaygroundPatternService {
    private patterns: Map<string, GamePattern>;

    constructor() {
        console.log("Initializing PlaygroundPatternService");
        this.patterns = new Map();
    }

    async initialize() {
        console.log("Starting service initialization");
        try {
            console.log("Loading patterns from patterns.json");
            const patternsData = await import(
                "../../../src/data/patterns.json"
            );
            console.log("Raw patterns data:", patternsData);

            const patterns = Array.isArray(patternsData.default)
                ? patternsData.default
                : patternsData;
            console.log("Processed patterns:", patterns);

            patterns.forEach((pattern: any) => {
                console.log("Processing pattern:", pattern.id);
                const mockPattern: GamePattern = {
                    ...pattern,
                    embedding: [Math.random(), Math.random()],
                };
                console.log("Created mock pattern:", mockPattern);
                this.patterns.set(pattern.id, mockPattern);
            });
            console.log(
                "Finished loading patterns. Total count:",
                this.patterns.size
            );
        } catch (error) {
            console.error("Failed to load patterns:", error);
            throw error;
        }
    }

    async getPatterns(): Promise<GamePattern[]> {
        console.log("Getting all patterns");
        const patterns = Array.from(this.patterns.values());
        console.log("Retrieved patterns:", patterns);
        return patterns;
    }

    async generateFromPrompt(prompt: string) {
        console.log("Generating pattern from prompt:", prompt);
        try {
            console.log("Calling Claude service");
            const response = await claudeService.generatePattern(prompt);
            console.log("Claude response:", response);
            return response;
        } catch (error) {
            console.error("Error generating pattern:", error);
            throw error;
        }
    }

    async searchSimilarPatterns(
        pattern: GamePattern,
        limit: number = 5
    ): Promise<GamePattern[]> {
        console.log("Searching similar patterns for:", pattern);
        console.log("Search limit:", limit);
        console.log(
            "Current patterns in store:",
            Array.from(this.patterns.entries())
        );

        const allPatterns = Array.from(this.patterns.values());
        console.log("All available patterns:", allPatterns);

        // First try to find patterns of the same type
        let filteredPatterns = allPatterns.filter(
            (p) => p.type === pattern.type && p.id !== pattern.id
        );
        console.log("Filtered patterns by type:", filteredPatterns);

        // If no patterns of the same type, return any patterns
        if (filteredPatterns.length === 0) {
            console.log(
                "No patterns of same type found, returning random patterns"
            );
            filteredPatterns = allPatterns.filter((p) => p.id !== pattern.id);
        }

        const selectedPatterns = filteredPatterns
            .sort(() => Math.random() - 0.5)
            .slice(0, limit);
        console.log("Selected similar patterns:", selectedPatterns);

        return selectedPatterns;
    }

    async comparePatterns(
        generatedHtml: string,
        pattern: GamePattern
    ): Promise<PatternEffectivenessMetrics> {
        console.log("Comparing patterns");
        console.log("Generated HTML:", generatedHtml);
        console.log("Reference pattern:", pattern);

        const metrics = {
            pattern_id: pattern.id,
            prompt_keywords: [],
            embedding_similarity: Math.random(),
            claude_usage: {
                direct_reuse: false,
                structural_similarity: Math.random(),
                feature_adoption: [],
                timestamp: new Date(),
            },
            quality_scores: {
                visual: Math.random(),
                interactive: Math.random(),
                functional: Math.random(),
                performance: Math.random(),
            },
            usage_stats: {
                total_uses: 1,
                successful_uses: 1,
                average_similarity: Math.random(),
                last_used: new Date(),
            },
        };
        console.log("Generated metrics:", metrics);
        return metrics;
    }

    async evolvePattern(
        pattern: GamePattern,
        config: {
            mutationRate?: number;
            populationSize?: number;
        } = {}
    ): Promise<GamePattern> {
        console.log("Evolving pattern:", pattern);
        console.log("Evolution config:", config);

        const evolvedPattern: GamePattern = {
            ...pattern,
            id: crypto.randomUUID(),
            pattern_name: `${pattern.pattern_name}_evolved`,
            content: {
                ...pattern.content,
                html: await this.applyEvolution(
                    pattern.content.html,
                    config.mutationRate || 0.3
                ),
            },
        };
        console.log("Evolved pattern:", evolvedPattern);

        console.log("Storing evolved pattern");
        await this.storePattern(evolvedPattern);
        return evolvedPattern;
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        console.log("Storing pattern:", pattern);
        this.patterns.set(pattern.id, pattern);
        console.log("Pattern stored successfully");
    }

    private async applyEvolution(
        html: string,
        mutationRate: number
    ): Promise<string> {
        console.log("Applying evolution to HTML");
        console.log("Original HTML:", html);
        console.log("Mutation rate:", mutationRate);

        // Add unique identifier to prevent variable name conflicts
        const uniqueId = crypto.randomUUID().split("-")[0];
        html = html.replace(/const keyboard=/g, `const keyboard_${uniqueId}=`);
        html = html.replace(
            /getElementById\('keyboard'\)/g,
            `getElementById('keyboard_${uniqueId}')`
        );
        html = html.replace(/id='keyboard'/g, `id='keyboard_${uniqueId}'`);

        const mutations = [
            this.addInteractivity,
            this.enhanceVisuals,
            this.improveLayout,
            this.addGameElements,
        ];

        let evolvedHtml = html;
        let mutationsApplied = false;

        for (const mutate of mutations) {
            if (Math.random() < mutationRate) {
                console.log("Applying mutation:", mutate.name);
                const newHtml = mutate(evolvedHtml);
                if (newHtml !== evolvedHtml) {
                    evolvedHtml = newHtml;
                    mutationsApplied = true;
                    console.log("Mutation applied successfully");
                }
            }
        }

        // Ensure at least one mutation is applied
        if (!mutationsApplied) {
            const randomMutation =
                mutations[Math.floor(Math.random() * mutations.length)];
            console.log("Forcing mutation:", randomMutation.name);
            evolvedHtml = randomMutation(evolvedHtml);
        }

        console.log("Evolved HTML:", evolvedHtml);
        return evolvedHtml;
    }

    private addInteractivity(html: string): string {
        const interactiveElements = [
            '<button onclick="this.classList.toggle(\'active\')" class="game-button" style="position: absolute; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Click Me</button>',
            '<div class="draggable" draggable="true" style="position: absolute; width: 50px; height: 50px; background: #2196F3; cursor: move;">Drag Me</div>',
            '<input type="range" class="game-slider" min="0" max="100" value="50" style="position: absolute; width: 200px;">',
        ];

        const element =
            interactiveElements[
                Math.floor(Math.random() * interactiveElements.length)
            ];
        return html.replace("</body>", `${element}</body>`);
    }

    private enhanceVisuals(html: string): string {
        const visualEnhancements = [
            "animation: pulse 2s infinite; @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }",
            "box-shadow: 0 0 20px rgba(0,255,255,0.5); transition: all 0.3s ease;",
            "background: linear-gradient(45deg, #ff00ff, #00ffff); background-size: 200% 200%; animation: gradient 5s ease infinite; @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }",
        ];

        const enhancement =
            visualEnhancements[
                Math.floor(Math.random() * visualEnhancements.length)
            ];
        if (html.includes("style=")) {
            return html.replace(
                /style="([^"]*)"/,
                (match, p1) => `style="${p1}; ${enhancement}"`
            );
        } else {
            return html.replace(/<div/, `<div style="${enhancement}"`);
        }
    }

    private improveLayout(html: string): string {
        const layouts = [
            "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 20px; padding: 20px;",
            "display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 15px;",
            "display: flex; flex-direction: column; gap: 15px; max-width: 800px; margin: 0 auto;",
        ];

        const layout = layouts[Math.floor(Math.random() * layouts.length)];
        if (html.includes("<body")) {
            return html.replace("<body", `<body style="${layout}"`);
        } else {
            return html.replace(/<div/, `<div style="${layout}"`);
        }
    }

    private addGameElements(html: string): string {
        const gameElements = [
            '<div class="score-display" style="position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px;">Score: <span>0</span></div>',
            '<div class="health-bar" style="position: fixed; top: 20px; left: 20px; width: 200px; height: 20px; background: #333; border-radius: 10px; overflow: hidden;"><div class="health-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ff0000, #00ff00); transition: width 0.3s ease;"></div></div>',
            '<div class="power-up" data-type="speed" style="position: absolute; width: 30px; height: 30px; background: yellow; border-radius: 50%; animation: float 2s infinite ease-in-out; cursor: pointer;">⚡</div><style>@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }</style>',
        ];

        const element =
            gameElements[Math.floor(Math.random() * gameElements.length)];
        return html.replace("</body>", `${element}</body>`);
    }
}

export const patternService = new PlaygroundPatternService();
