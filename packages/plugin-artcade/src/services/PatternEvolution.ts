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
        const mutatedPattern = { ...pattern, id: uuidv4() };

        // List of available mutation operators
        const operators = [
            "add_interaction",
            "modify_style",
            "add_animation",
            "change_layout",
            "add_game_element",
        ];

        // Log available operators
        this.runtime.logger.info("Available mutation operators:", operators);

        // Apply first mutation
        const firstOperator =
            operators[Math.floor(Math.random() * operators.length)];
        this.runtime.logger.info("Applying first mutation:", firstOperator);
        mutatedPattern.content.html = await this.applyMutation(
            mutatedPattern.content.html,
            firstOperator
        );

        // Potentially apply additional mutations based on rate
        for (const operator of operators) {
            if (Math.random() < rate) {
                this.runtime.logger.info(
                    "Applying additional mutation:",
                    operator
                );
                mutatedPattern.content.html = await this.applyMutation(
                    mutatedPattern.content.html,
                    operator
                );
            }
        }

        return this.staging.validatePattern(mutatedPattern);
    }

    private async applyMutation(
        html: string,
        operator: string
    ): Promise<string> {
        switch (operator) {
            case "add_game_element":
                return this.addGameElement(html);
            case "add_interaction":
                return this.addInteraction(html);
            case "modify_style":
                return this.modifyStyle(html);
            case "add_animation":
                return this.addAnimation(html);
            case "change_layout":
                return this.changeLayout(html);
            default:
                return html;
        }
    }

    private addGameElement(html: string): string {
        const elements = [
            // Collision detection element
            `<div class="game-player" data-collision="true" style="width: 32px; height: 32px; background-color: rgb(255, 0, 0); position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);">
                <script>
                    setInterval(() => {
                        const player = document.querySelector('.game-player');
                        const rect = player.getBoundingClientRect();
                        // Collision detection logic
                        document.querySelectorAll('[data-collision="true"]').forEach(element => {
                            if (element === player) return;
                            const rect2 = element.getBoundingClientRect();
                            if (rect.left < rect2.right && rect.right > rect2.left &&
                                rect.top < rect2.bottom && rect.bottom > rect2.top) {
                                element.dispatchEvent(new CustomEvent('collision', { detail: { player } }));
                            }
                        });
                    }, 16);
                </script>
            </div>`,

            // Power-up element with game state
            `<div class="game-powerup" data-effect="speed" data-duration="5000" style="width: 16px; height: 16px; background-color: rgb(255, 255, 0); position: absolute; border-radius: 50%; animation: float 2s infinite ease-in-out;">
                <script>
                    const gameState = {
                        score: 0,
                        health: 100,
                        powerups: [],
                        level: 1,
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
                </script>
            </div>`,

            // Level progression element
            `<div class="game-portal" data-next-level="true" style="width: 48px; height: 48px; background: linear-gradient(45deg, #00f, #f0f); border-radius: 50%; animation: pulse 2s infinite;">
                <script>
                    function nextLevel() {
                        gameState.level++;
                        updateGameState();
                    }
                </script>
            </div>`,

            // Game controls
            `<div class="game-controls" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px;">
                <button class="control-left" ontouchstart="movePlayer('left')" ontouchend="stopPlayer()">←</button>
                <button class="control-right" ontouchstart="movePlayer('right')" ontouchend="stopPlayer()">→</button>
                <button class="control-action" ontouchstart="playerAction()">Action</button>
                <script>
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
            </div>`,

            // Score display
            `<div class="game-score" style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; background-color: rgb(51, 51, 51); color: rgb(255, 255, 255); border-radius: 5px;">Score: <span>0</span></div>`,
        ];

        const element = elements[Math.floor(Math.random() * elements.length)];
        return html.replace("</div>", `${element}</div>`);
    }

    private addInteraction(html: string): string {
        const interactions = [
            // Keyboard controls
            `<script>
                document.addEventListener("keydown", (e) => {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;

                    switch(e.key) {
                        case "ArrowLeft":
                            player.style.left = (parseInt(player.style.left || 0) - speed) + 'px';
                            break;
                        case "ArrowRight":
                            player.style.left = (parseInt(player.style.left || 0) + speed) + 'px';
                            break;
                        case "ArrowUp":
                            player.style.top = (parseInt(player.style.top || 0) - speed) + 'px';
                            break;
                        case "ArrowDown":
                            player.style.top = (parseInt(player.style.top || 0) + speed) + 'px';
                            break;
                        case " ":
                            player.dispatchEvent(new CustomEvent('action'));
                            break;
                    }
                });
            </script>`,

            // Click interaction
            `<div class="interactive" onclick="this.classList.toggle('active'); gameState.updateScore(10);">Click me!</div>`,

            // Hover effect
            `<div class="hoverable" onmouseover="this.style.transform='scale(1.1)'; gameState.updateHealth(5);" onmouseout="this.style.transform='scale(1)'">Hover me!</div>`,

            // Drag and drop
            `<div class="draggable" draggable="true" ondragstart="event.dataTransfer.setData('text', event.target.id); gameState.addPowerup('speed', 5000);">Drag me!</div>`,
        ];

        const interaction =
            interactions[Math.floor(Math.random() * interactions.length)];
        return html.replace("</div>", `${interaction}</div>`);
    }

    private modifyStyle(html: string): string {
        const styles = [
            "background-color: rgb(168, 168, 168); border-radius: 8px; padding: 10px;",
            "color: rgb(23, 23, 23); font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);",
            "border: 2px solid #333; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); margin: 10px;",
            "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px;",
        ];

        const style = styles[Math.floor(Math.random() * styles.length)];
        return html.replace(/style="[^"]*"/, `style="${style}"`);
    }

    private addAnimation(html: string): string {
        const animations = [
            "animation: pulse 2s infinite; transform: scale(1);",
            "animation: rotate 3s linear infinite; transform-origin: center;",
            "animation: bounce 1s infinite; transform: translateY(0);",
            "animation: float 2s infinite ease-in-out;",
        ];

        const animation =
            animations[Math.floor(Math.random() * animations.length)];
        return html.replace(/style="([^"]*)"/, `style="$1 ${animation}"`);
    }

    private changeLayout(html: string): string {
        const layouts = [
            "display: flex; flex-direction: column; gap: 10px; justify-content: space-between;",
            "display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;",
            "position: relative; margin: 20px; padding: 15px;",
            "display: flex; flex-direction: row; gap: 10px; justify-content: space-between;",
        ];

        const layout = layouts[Math.floor(Math.random() * layouts.length)];
        return html.replace(/style="([^"]*)"/, `style="$1 ${layout}"`);
    }
}