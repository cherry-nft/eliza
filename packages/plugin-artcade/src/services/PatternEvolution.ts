import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { VectorDatabase, VectorSearchResult } from "./VectorDatabase";
import { PatternStaging, GamePattern } from "./PatternStaging";
import { v4 as uuidv4 } from "uuid";

export interface EvolutionConfig {
    populationSize?: number;
    generationLimit?: number;
    mutationRate?: number;
    crossoverRate?: number;
    elitismCount?: number;
    similarityThreshold?: number;
    fitnessThreshold?: number;
}

export interface EvolutionResult {
    pattern: GamePattern;
    fitness: number;
    generation: number;
    parentIds: string[];
}

export class PatternEvolution extends Service {
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };
    private vectorDb!: VectorDatabase;
    private staging!: PatternStaging;

    private readonly defaultConfig: Required<EvolutionConfig> = {
        populationSize: 10,
        generationLimit: 50,
        mutationRate: 0.3,
        crossoverRate: 0.7,
        elitismCount: 2,
        similarityThreshold: 0.85,
        fitnessThreshold: 0.7,
    };

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
        this.vectorDb = await runtime.getService(VectorDatabase);
        this.staging = await runtime.getService(PatternStaging);
    }

    async evolvePattern(
        seedPattern: GamePattern,
        config: EvolutionConfig = {}
    ): Promise<EvolutionResult> {
        const evolutionConfig = { ...this.defaultConfig, ...config };

        try {
            // Find similar patterns to use as potential parents
            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                seedPattern.embedding,
                seedPattern.type,
                evolutionConfig.similarityThreshold
            );

            // Initialize population with seed and similar patterns
            let population = this.initializePopulation(
                seedPattern,
                similarPatterns,
                evolutionConfig.populationSize
            );

            let bestResult: EvolutionResult = {
                pattern: seedPattern,
                fitness: await this.evaluateFitness(seedPattern),
                generation: 0,
                parentIds: [],
            };

            // Evolution loop
            for (
                let generation = 1;
                generation <= evolutionConfig.generationLimit;
                generation++
            ) {
                // Evaluate fitness for current population
                const evaluatedPopulation = await Promise.all(
                    population.map(async (pattern) => ({
                        pattern,
                        fitness: await this.evaluateFitness(pattern),
                    }))
                );

                // Sort by fitness
                evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);

                // Check if we've found a better solution
                if (evaluatedPopulation[0].fitness > bestResult.fitness) {
                    bestResult = {
                        pattern: evaluatedPopulation[0].pattern,
                        fitness: evaluatedPopulation[0].fitness,
                        generation,
                        parentIds: [seedPattern.id],
                    };

                    // If we've reached our fitness threshold, we can stop
                    if (
                        bestResult.fitness >= evolutionConfig.fitnessThreshold
                    ) {
                        break;
                    }
                }

                // Create next generation
                const nextGeneration: GamePattern[] = [];

                // Elitism - carry over best patterns
                for (let i = 0; i < evolutionConfig.elitismCount; i++) {
                    nextGeneration.push(evaluatedPopulation[i].pattern);
                }

                // Fill rest of population with offspring
                while (nextGeneration.length < evolutionConfig.populationSize) {
                    if (Math.random() < evolutionConfig.crossoverRate) {
                        // Crossover
                        const parent1 = this.selectParent(evaluatedPopulation);
                        const parent2 = this.selectParent(evaluatedPopulation);
                        const offspring = await this.crossover(
                            parent1,
                            parent2
                        );
                        nextGeneration.push(offspring);
                    } else {
                        // Mutation
                        const parent = this.selectParent(evaluatedPopulation);
                        const offspring = await this.mutate(
                            parent,
                            evolutionConfig.mutationRate
                        );
                        nextGeneration.push(offspring);
                    }
                }

                population = nextGeneration;
            }

            // Store the best result in the vector database
            await this.vectorDb.storePattern(bestResult.pattern);

            return bestResult;
        } catch (error) {
            this.runtime.logger.error("Error during pattern evolution", {
                error,
            });
            throw error;
        }
    }

    private initializePopulation(
        seedPattern: GamePattern,
        similarPatterns: VectorSearchResult[],
        size: number
    ): GamePattern[] {
        const population: GamePattern[] = [seedPattern];

        // Add similar patterns
        population.push(...similarPatterns.map((result) => result.pattern));

        // Fill remaining slots with mutations of existing patterns
        while (population.length < size) {
            const basePattern =
                population[Math.floor(Math.random() * population.length)];
            population.push({
                ...basePattern,
                id: uuidv4(),
                pattern_name: `${basePattern.pattern_name}_variant_${population.length}`,
            });
        }

        return population;
    }

    private async evaluateFitness(pattern: GamePattern): Promise<number> {
        // Combine multiple fitness metrics
        const metrics = await Promise.all([
            this.evaluateComplexity(pattern),
            this.evaluateInteractivity(pattern),
            this.evaluateVisualAppeal(pattern),
            this.evaluatePerformance(pattern),
        ]);

        // Weighted average of metrics
        const weights = [0.3, 0.3, 0.2, 0.2];
        return metrics.reduce((sum, metric, i) => sum + metric * weights[i], 0);
    }

    private async evaluateComplexity(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Evaluate HTML complexity
        if (content.html) {
            // Count elements
            const elementCount = (content.html.match(/<[^>]+>/g) || []).length;
            score += Math.min(elementCount / 20, 0.25); // Max 0.25 for element count

            // Count nested depth
            const maxDepth = content.html.split("<").reduce((depth, part) => {
                if (part.trim().startsWith("/")) depth--;
                else if (part.includes(">")) depth++;
                return Math.max(depth, 0);
            }, 0);
            score += Math.min(maxDepth / 5, 0.25); // Max 0.25 for nesting depth
        }

        // Evaluate CSS complexity
        if (content.css) {
            // Count rules and properties
            const ruleCount = (content.css.match(/{[^}]*}/g) || []).length;
            score += Math.min(ruleCount / 10, 0.25); // Max 0.25 for CSS rules

            // Count animations and transitions
            const animationCount = (
                content.css.match(/@keyframes|animation:|transition:/g) || []
            ).length;
            score += Math.min(animationCount / 4, 0.25); // Max 0.25 for animations
        }

        return Math.min(score, maxScore);
    }

    private async evaluateInteractivity(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Count event listeners
        const eventListeners = (content.html.match(/on[a-z]+=/gi) || []).length;
        score += Math.min(eventListeners / 10, 0.3); // Max 0.3 for event listeners

        // Count interactive classes
        const interactiveClasses = (
            content.html.match(/class="[^"]*interactive[^"]*"/g) || []
        ).length;
        score += Math.min(interactiveClasses / 5, 0.2); // Max 0.2 for interactive classes

        // Count draggable elements
        const draggableElements = (
            content.html.match(/draggable="true"/g) || []
        ).length;
        score += Math.min(draggableElements / 3, 0.2); // Max 0.2 for draggable elements

        // Check for game elements
        const gameElements = (
            content.html.match(/class="[^"]*game-[^"]*"/g) || []
        ).length;
        score += Math.min(gameElements / 4, 0.3); // Max 0.3 for game elements

        return Math.min(score, maxScore);
    }

    private async evaluateVisualAppeal(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Check for color variety
        const colors = new Set(
            content.html.match(/(?:color|background-color):\s*([^;}"']+)/g) ||
                []
        );
        score += Math.min(colors.size / 5, 0.25); // Max 0.25 for color variety

        // Check for animations
        const animations = (content.html.match(/animation:[^;}"']+/g) || [])
            .length;
        score += Math.min(animations / 5, 0.25); // Max 0.25 for animations

        // Check for transitions
        const transitions = (content.html.match(/transition:[^;}"']+/g) || [])
            .length;
        score += Math.min(transitions / 3, 0.25); // Max 0.25 for transitions

        // Check for layout properties
        const layoutProps = (
            content.html.match(/(?:display|grid|flex|position):[^;}"']+/g) || []
        ).length;
        score += Math.min(layoutProps / 5, 0.25); // Max 0.25 for layout properties

        return Math.min(score, maxScore);
    }

    private async evaluatePerformance(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 1; // Start with perfect score and deduct for potential issues
        const maxScore = 1;

        // Check DOM size (deduct for excessive elements)
        const elementCount = (content.html.match(/<[^>]+>/g) || []).length;
        if (elementCount > 50) score -= 0.2;
        if (elementCount > 100) score -= 0.2;

        // Check animation complexity (deduct for excessive animations)
        const animationCount = (content.html.match(/animation:[^;}"']+/g) || [])
            .length;
        if (animationCount > 10) score -= 0.2;
        if (animationCount > 20) score -= 0.2;

        // Check style complexity (deduct for excessive inline styles)
        const inlineStyles = (content.html.match(/style="[^"]+"/g) || [])
            .length;
        if (inlineStyles > 20) score -= 0.2;
        if (inlineStyles > 40) score -= 0.2;

        // Check for expensive operations in event handlers
        const expensiveOps = (
            content.html.match(
                /setTimeout|setInterval|requestAnimationFrame/g
            ) || []
        ).length;
        if (expensiveOps > 5) score -= 0.2;
        if (expensiveOps > 10) score -= 0.2;

        return Math.max(0, Math.min(score, maxScore));
    }

    private selectParent(
        evaluatedPopulation: { pattern: GamePattern; fitness: number }[]
    ): GamePattern {
        // Tournament selection
        const tournamentSize = 3;
        const tournament = Array(tournamentSize)
            .fill(null)
            .map(
                () =>
                    evaluatedPopulation[
                        Math.floor(Math.random() * evaluatedPopulation.length)
                    ]
            );
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].pattern;
    }

    private async crossover(
        parent1: GamePattern,
        parent2: GamePattern
    ): Promise<GamePattern> {
        // Create new pattern combining features from both parents
        const newPattern: GamePattern = {
            id: uuidv4(),
            type: parent1.type,
            pattern_name: `${parent1.pattern_name}_${parent2.pattern_name}_offspring`,
            content: await this.crossoverContent(
                parent1.content,
                parent2.content
            ),
            embedding: parent1.embedding.map(
                (value, i) => (value + parent2.embedding[i]) / 2
            ),
            effectiveness_score:
                (parent1.effectiveness_score + parent2.effectiveness_score) / 2,
            usage_count: 0,
        };

        // Validate through staging service
        return await this.staging.validatePattern(newPattern);
    }

    private async crossoverContent(content1: any, content2: any): Promise<any> {
        if (!content1 || !content2) return content1 || content2;

        const newContent = {
            html: this.crossoverHtml(content1.html, content2.html),
            css: this.crossoverCss(content1.css, content2.css),
            context: content1.context,
            metadata: { ...content1.metadata },
        };

        // Merge metadata
        if (content2.metadata) {
            Object.entries(content2.metadata).forEach(([key, value]) => {
                if (!newContent.metadata[key]) {
                    newContent.metadata[key] = value;
                }
            });
        }

        return newContent;
    }

    private crossoverHtml(html1: string, html2: string): string {
        if (!html1 || !html2) return html1 || html2;

        // Extract elements from both parents
        const elements1 = html1.match(/<div[^>]*>.*?<\/div>/gs) || [];
        const elements2 = html2.match(/<div[^>]*>.*?<\/div>/gs) || [];

        // Combine elements from both parents
        const combinedElements = [...elements1, ...elements2];

        // Select a random subset of elements
        const selectedElements = combinedElements
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.floor((elements1.length + elements2.length) / 2));

        // Wrap in a container
        return `<div class="container">${selectedElements.join("\n")}</div>`;
    }

    private crossoverCss(css1: string, css2: string): string {
        if (!css1 || !css2) return css1 || css2;

        // Extract rules and animations from both parents
        const rules1 = css1.match(/[^@].*{[^}]*}/g) || [];
        const rules2 = css2.match(/[^@].*{[^}]*}/g) || [];
        const animations1 = css1.match(/@keyframes[^}]*}/g) || [];
        const animations2 = css2.match(/@keyframes[^}]*}/g) || [];

        // Combine unique rules and animations
        const combinedRules = [...new Set([...rules1, ...rules2])];
        const combinedAnimations = [
            ...new Set([...animations1, ...animations2]),
        ];

        return [...combinedAnimations, ...combinedRules].join("\n");
    }

    private async mutate(
        pattern: GamePattern,
        rate: number
    ): Promise<GamePattern> {
        const mutatedPattern: GamePattern = {
            ...pattern,
            id: uuidv4(),
            pattern_name: `${pattern.pattern_name}_mutated`,
            content: await this.mutateContent(pattern.content, rate),
            embedding: pattern.embedding.map(
                (value) => value + (Math.random() - 0.5) * rate
            ),
        };

        // Validate through staging service
        return await this.staging.validatePattern(mutatedPattern);
    }

    private async mutateContent(content: any, rate: number): Promise<any> {
        if (!content) return content;

        const mutatedContent = { ...content };

        // Always apply game mechanics first
        await this.mutateGameLogic(mutatedContent);

        const operations = [
            this.mutateHtmlElements,
            this.mutateHtmlAttributes,
            this.mutateHtmlClasses,
            this.mutateCssStyles,
            this.mutateCssAnimations,
        ];

        // Apply random mutations based on rate
        for (const operation of operations) {
            if (Math.random() < rate) {
                try {
                    await operation.call(this, mutatedContent);
                } catch (error) {
                    this.runtime.logger.error(
                        `Mutation operation failed: ${error}`
                    );
                }
            }
        }

        return mutatedContent;
    }

    private async mutateGameLogic(content: any): Promise<void> {
        if (!content.html) content.html = "";

        // Add game state management
        const gameStateScript = `
            <script>
                window.gameState = {
                    score: 0,
                    health: 100,
                    level: 1,
                    powerups: [],
                    combo: 0,
                    updateScore: function(points) {
                        this.score += points * (this.combo + 1);
                        document.querySelector('.game-score span').textContent = this.score;
                    },
                    updateHealth: function(amount) {
                        this.health = Math.max(0, Math.min(100, this.health + amount));
                        document.querySelector('.game-health span').textContent = this.health;
                        if (this.health <= 0) this.gameOver();
                    },
                    addPowerup: function(effect, duration) {
                        this.powerups.push({ effect, expires: Date.now() + duration });
                        setTimeout(() => this.removePowerup(effect), duration);
                    },
                    removePowerup: function(effect) {
                        this.powerups = this.powerups.filter(p => p.effect !== effect);
                    },
                    gameOver: function() {
                        document.dispatchEvent(new CustomEvent('gameOver', { detail: { score: this.score } }));
                    }
                };

                // Collision detection
                setInterval(() => {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    document.querySelectorAll('[data-collision="true"]').forEach(element => {
                        if (element === player) return;
                        const rect1 = player.getBoundingClientRect();
                        const rect2 = element.getBoundingClientRect();
                        if (rect1.left < rect2.right && rect1.right > rect2.left &&
                            rect1.top < rect2.bottom && rect1.bottom > rect2.top) {
                            element.dispatchEvent(new CustomEvent('collision', { detail: { player } }));
                        }
                    });
                }, 16);

                // Keyboard controls
                document.addEventListener('keydown', (e) => {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;
                    switch(e.key) {
                        case 'ArrowLeft': player.style.left = (parseInt(player.style.left || 0) - speed) + 'px'; break;
                        case 'ArrowRight': player.style.left = (parseInt(player.style.left || 0) + speed) + 'px'; break;
                        case 'ArrowUp': player.style.top = (parseInt(player.style.top || 0) - speed) + 'px'; break;
                        case 'ArrowDown': player.style.top = (parseInt(player.style.top || 0) + speed) + 'px'; break;
                        case ' ': player.dispatchEvent(new CustomEvent('action')); break;
                    }
                });

                // Touch controls
                function movePlayer(direction) {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;
                    switch(direction) {
                        case 'left': player.style.left = (parseInt(player.style.left || 0) - speed) + 'px'; break;
                        case 'right': player.style.left = (parseInt(player.style.left || 0) + speed) + 'px'; break;
                    }
                }

                function stopPlayer() {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    player.style.transition = 'none';
                }

                function playerAction() {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    player.dispatchEvent(new CustomEvent('action'));
                }
            </script>
        `;

        // Add game elements
        const gameElements = `
            <div class="game-player" style="width: 32px; height: 32px; background: red; position: absolute;" data-collision="true" data-speed="5"></div>
            <div class="game-collectible" style="width: 16px; height: 16px; background: yellow; border-radius: 50%; position: absolute;" data-collision="true" data-points="10"></div>
            <div class="game-powerup speed" style="width: 20px; height: 20px; background: blue; position: absolute;" data-collision="true" data-effect="speed" data-duration="5000"></div>
            <div class="game-portal" style="width: 40px; height: 40px; background: green; position: absolute;" data-collision="true" data-next-level="true"></div>
        `;

        // Add UI elements
        const uiElements = `
            <div class="game-score">Score: <span>0</span></div>
            <div class="game-health">Health: <span>100</span></div>
            <div class="game-level">Level: <span>1</span></div>
        `;

        // Add touch controls
        const touchControls = `
            <div class="game-controls" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px;">
                <button class="control-left" ontouchstart="movePlayer('left')" ontouchend="stopPlayer()">←</button>
                <button class="control-right" ontouchstart="movePlayer('right')" ontouchend="stopPlayer()">→</button>
                <button class="control-action" ontouchstart="playerAction()">Action</button>
            </div>
        `;

        // Insert game elements at appropriate positions
        const containerMatch = content.html.match(
            /<div[^>]*class="[^"]*container[^"]*"[^>]*>/
        );
        if (containerMatch) {
            const insertPosition =
                containerMatch.index + containerMatch[0].length;
            content.html =
                content.html.slice(0, insertPosition) +
                gameElements +
                uiElements +
                touchControls +
                content.html.slice(insertPosition);
        } else {
            content.html = `<div class="container">${gameElements}${uiElements}${touchControls}${content.html}</div>`;
        }

        // Add game logic script at the end
        if (!content.html.includes("gameState")) {
            content.html = gameStateScript + content.html;
        }
    }

    private async mutateHtmlElements(content: any): Promise<void> {
        if (!content.html) return;

        const gameElements = [
            // Basic game elements
            '<div class="game-player" style="width: 32px; height: 32px; background: red; position: absolute;" data-collision="true" data-speed="5"></div>',
            '<div class="game-collectible" style="width: 16px; height: 16px; background: yellow; border-radius: 50%; position: absolute;" data-collision="true" data-points="10"></div>',
            '<div class="game-obstacle" style="width: 48px; height: 16px; background: #666; position: absolute;" data-collision="true" data-damage="20"></div>',
            '<div class="game-score">Score: <span>0</span></div>',
            '<div class="game-health">Health: <span>100</span></div>',
            '<div class="game-timer">Time: <span>60</span></div>',

            // Power-ups
            '<div class="game-powerup speed" style="width: 20px; height: 20px; background: blue; position: absolute;" data-collision="true" data-effect="speed" data-duration="5000"></div>',
            '<div class="game-powerup invincible" style="width: 20px; height: 20px; background: purple; position: absolute;" data-collision="true" data-effect="invincible" data-duration="3000"></div>',

            // Level elements
            '<div class="game-portal" style="width: 40px; height: 40px; background: green; position: absolute;" data-collision="true" data-next-level="true"></div>',
            '<div class="game-checkpoint" style="width: 24px; height: 24px; background: cyan; position: absolute;" data-collision="true" data-save-point="true"></div>',

            // UI elements
            '<div class="game-level">Level: <span>1</span></div>',
            '<div class="game-multiplier">Multiplier: <span>1x</span></div>',
            '<div class="game-combo">Combo: <span>0</span></div>',
        ];

        const gameControls = [
            // Keyboard controls
            '<script>document.addEventListener("keydown", (e) => {' +
                '  const player = document.querySelector(".game-player");' +
                "  if (!player) return;" +
                "  const speed = parseInt(player.dataset.speed) || 5;" +
                "  switch(e.key) {" +
                '    case "ArrowLeft": player.style.left = (parseInt(player.style.left || 0) - speed) + "px"; break;' +
                '    case "ArrowRight": player.style.left = (parseInt(player.style.left || 0) + speed) + "px"; break;' +
                '    case "ArrowUp": player.style.top = (parseInt(player.style.top || 0) - speed) + "px"; break;' +
                '    case "ArrowDown": player.style.top = (parseInt(player.style.top || 0) + speed) + "px"; break;' +
                '    case " ": player.dispatchEvent(new CustomEvent("action")); break;' +
                "  }" +
                "});</script>",

            // Touch controls
            '<div class="game-controls" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px;">' +
                '  <button class="control-left" ontouchstart="movePlayer(\'left\')" ontouchend="stopPlayer()">←</button>' +
                '  <button class="control-right" ontouchstart="movePlayer(\'right\')" ontouchend="stopPlayer()">→</button>' +
                '  <button class="control-action" ontouchstart="playerAction()">Action</button>' +
                "</div>",
        ];

        const gameLogic = [
            // Collision detection
            "<script>setInterval(() => {" +
                '  const player = document.querySelector(".game-player");' +
                "  if (!player) return;" +
                '  document.querySelectorAll("[data-collision=true]").forEach(element => {' +
                "    if (element === player) return;" +
                "    const rect1 = player.getBoundingClientRect();" +
                "    const rect2 = element.getBoundingClientRect();" +
                "    if (rect1.left < rect2.right && rect1.right > rect2.left && " +
                "        rect1.top < rect2.bottom && rect1.bottom > rect2.top) {" +
                '      element.dispatchEvent(new CustomEvent("collision", { detail: { player } }));' +
                "    }" +
                "  });" +
                "}, 16);</script>",

            // Game state management
            "<script>const gameState = {" +
                "  score: 0, health: 100, level: 1, powerups: [], combo: 0," +
                "  updateScore: function(points) {" +
                "    this.score += points * (this.combo + 1);" +
                '    document.querySelector(".game-score span").textContent = this.score;' +
                "  }," +
                "  updateHealth: function(amount) {" +
                "    this.health = Math.max(0, Math.min(100, this.health + amount));" +
                '    document.querySelector(".game-health span").textContent = this.health;' +
                "    if (this.health <= 0) this.gameOver();" +
                "  }," +
                "  addPowerup: function(effect, duration) {" +
                "    this.powerups.push({ effect, expires: Date.now() + duration });" +
                "    setTimeout(() => this.removePowerup(effect), duration);" +
                "  }," +
                "  removePowerup: function(effect) {" +
                "    this.powerups = this.powerups.filter(p => p.effect !== effect);" +
                "  }," +
                "  gameOver: function() {" +
                '    document.dispatchEvent(new CustomEvent("gameOver", { detail: { score: this.score } }));' +
                "  }" +
                "};</script>",
        ];

        // Add a random game element
        const allElements = [...gameElements, ...gameControls, ...gameLogic];
        const randomElement =
            allElements[Math.floor(Math.random() * allElements.length)];

        // Insert at a reasonable position
        if (randomElement.startsWith("<script>")) {
            // Add scripts at the end
            content.html += randomElement;
        } else {
            // Insert other elements after an existing div
            const divMatch = content.html.match(/<\/div>/);
            if (divMatch) {
                const insertPosition = divMatch.index;
                content.html =
                    content.html.slice(0, insertPosition) +
                    randomElement +
                    content.html.slice(insertPosition);
            }
        }
    }

    private async mutateHtmlAttributes(content: any): Promise<void> {
        if (!content.html) return;

        const attributes = [
            ['draggable="true"', "onclick=\"this.classList.toggle('active')"],
            [
                'style="cursor: pointer;"',
                "onmouseover=\"this.style.opacity='0.8'\"",
            ],
            ['data-interactive="true"', 'role="button"'],
        ];

        // Add random attributes to existing elements
        const randomAttr =
            attributes[Math.floor(Math.random() * attributes.length)];
        content.html = content.html.replace(
            /<div(?![^>]*class="game-[^"]*")[^>]*>/,
            (match) => match.replace(">", ` ${randomAttr}>`)
        );
    }

    private async mutateHtmlClasses(content: any): Promise<void> {
        if (!content.html) return;

        const classes = [
            "interactive",
            "hoverable",
            "clickable",
            "animated",
            "game-element",
            "collectible",
            "obstacle",
            "power-up",
        ];

        // Add a random class to an existing element
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        content.html = content.html.replace(
            /<div(?![^>]*class="game-[^"]*")[^>]*>/,
            (match) => {
                if (match.includes('class="')) {
                    return match.replace('class="', `class="${randomClass} `);
                }
                return match.replace(">", ` class="${randomClass}">`);
            }
        );
    }

    private async mutateCssStyles(content: any): Promise<void> {
        if (!content.css) content.css = "";

        const styles = [
            `.interactive:hover { transform: scale(1.1); transition: transform 0.2s; }`,
            `.clickable { cursor: pointer; user-select: none; }`,
            `.hoverable { transition: all 0.3s ease; }`,
            `.game-element { position: relative; overflow: hidden; }`,
            `.animated { animation: pulse 2s infinite; }`,
        ];

        // Add a random style
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        content.css += `\n${randomStyle}`;
    }

    private async mutateCssAnimations(content: any): Promise<void> {
        if (!content.css) content.css = "";

        const animations = [
            `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`,
            `@keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }`,
            `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`,
            `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`,
        ];

        // Add a random animation
        const randomAnimation =
            animations[Math.floor(Math.random() * animations.length)];
        content.css += `\n${randomAnimation}`;
    }
}
