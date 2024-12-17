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
        const crossedPattern = await this.crossoverContent(parent1, parent2);
        return this.staging.validatePattern(crossedPattern);
    }

    private async crossoverContent(
        parent1: GamePattern,
        parent2: GamePattern
    ): Promise<GamePattern> {
        const html1 = parent1.content.html;
        const html2 = parent2.content.html;

        // Extract game elements from both parents
        const elements1 =
            html1.match(/<div[^>]*class="[^"]*game-[^"]*"[^>]*>.*?<\/div>/g) ||
            [];
        const elements2 =
            html2.match(/<div[^>]*class="[^"]*game-[^"]*"[^>]*>.*?<\/div>/g) ||
            [];

        // Combine elements from both parents
        const combinedElements = [...elements1, ...elements2];
        const selectedElements = combinedElements
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.floor(combinedElements.length / 2));

        // Create new HTML with combined elements
        let newHtml = html1;
        const insertPosition = newHtml.lastIndexOf("</div>");
        if (insertPosition !== -1) {
            newHtml =
                newHtml.slice(0, insertPosition) +
                selectedElements.join("") +
                newHtml.slice(insertPosition);
        }

        // Add game mechanics
        newHtml = this.addGameMechanics(newHtml);

        return {
            ...parent1,
            id: uuidv4(),
            pattern_name: `${parent1.pattern_name}_${parent2.pattern_name}_crossover`,
            content: { ...parent1.content, html: newHtml },
        };
    }

    private async mutate(
        pattern: GamePattern,
        mutationRate: number
    ): Promise<GamePattern> {
        const mutatedPattern = { ...pattern };
        const content = mutatedPattern.content;

        // Available mutation operators
        const operators = [
            "add_interaction",
            "modify_style",
            "add_animation",
            "change_layout",
            "add_game_element",
        ];

        // Log available operators
        this.runtime.logger.debug("Available mutation operators:", operators);

        // Always apply game element and layout mutations
        content.html = this.applyGameElementMutation(content.html);
        content.html = this.applyLayoutMutation(content.html);

        // Apply additional mutations based on rate
        let mutationCount = 2; // Start at 2 since we've already applied 2 mutations
        while (Math.random() < mutationRate && mutationCount < 10) {
            const operator =
                operators[Math.floor(Math.random() * operators.length)];
            this.runtime.logger.debug(
                `Applying additional mutation: ${operator}`
            );

            switch (operator) {
                case "add_game_element":
                    content.html = this.applyGameElementMutation(content.html);
                    break;
                case "add_interaction":
                    content.html = this.applyInteractionMutation(content.html);
                    break;
                case "modify_style":
                    content.html = this.applyStyleMutation(content.html);
                    break;
                case "add_animation":
                    content.html = this.applyAnimationMutation(content.html);
                    break;
                case "change_layout":
                    content.html = this.applyLayoutMutation(content.html);
                    break;
            }
            mutationCount++;
        }

        // Add game mechanics
        content.html = this.addGameMechanics(content.html);

        // Validate the mutated pattern
        return await this.staging.validatePattern({
            ...mutatedPattern,
            id: uuidv4(),
            pattern_name: `${pattern.pattern_name}_mutated_${Date.now()}`,
            content,
        });
    }

    private applyInteractionMutation(html: string): string {
        const interactions = [
            {
                class: "interactive",
                attr: "onclick=\"this.classList.toggle('active')\"",
            },
            {
                class: "hoverable",
                attr: "onmouseover=\"this.style.transform='scale(1.1)'\" onmouseout=\"this.style.transform='scale(1)'\"",
            },
            {
                class: "draggable",
                attr: 'draggable="true" ondragstart="event.dataTransfer.setData(\'text\', event.target.id)"',
            },
        ];

        const interaction =
            interactions[Math.floor(Math.random() * interactions.length)];
        return html.replace(
            /<div/i,
            `<div class="${interaction.class}" ${interaction.attr}`
        );
    }

    private applyStyleMutation(html: string): string {
        const styles = [
            "border: 2px solid #333; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); margin: 10px;",
            "color: rgb(23, 23, 23); font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);",
            "background-color: rgb(168, 168, 168); border-radius: 8px; padding: 10px;",
        ];

        const style = styles[Math.floor(Math.random() * styles.length)];
        return html.replace(
            /style="([^"]*)"/,
            (match, p1) => `style="${p1}; ${style}"`
        );
    }

    private applyAnimationMutation(html: string): string {
        const animations = [
            "animation: pulse 2s infinite; transform: scale(1);",
            "animation: rotate 3s linear infinite; transform-origin: center;",
            "animation: bounce 1s infinite; transform: translateY(0);",
        ];

        const animation =
            animations[Math.floor(Math.random() * animations.length)];
        return html.replace(
            /style="([^"]*)"/,
            (match, p1) => `style="${p1}; ${animation}"`
        );
    }

    private applyLayoutMutation(html: string): string {
        const layouts = [
            "display: flex; flex-direction: row; gap: 10px; justify-content: space-between;",
            "display: flex; flex-direction: column; gap: 10px; justify-content: space-between;",
            "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px;",
        ];

        const layout = layouts[Math.floor(Math.random() * layouts.length)];

        // First, try to find container or game-container divs
        const containerMatch = html.match(
            /<div[^>]*class="[^"]*(?:container|game-container)[^"]*"[^>]*>/
        );
        if (containerMatch) {
            const styleMatch = containerMatch[0].match(/style="([^"]*)"/);
            if (styleMatch) {
                // Preserve existing styles while adding layout
                const existingStyles = styleMatch[1];
                const newStyles = layout
                    .split(";")
                    .filter((style) => {
                        const prop = style.split(":")[0]?.trim();
                        return prop && !existingStyles.includes(prop + ":");
                    })
                    .join(";");
                return html.replace(
                    styleMatch[0],
                    `style="${existingStyles}; ${newStyles}"`
                );
            } else {
                return html.replace(
                    containerMatch[0],
                    containerMatch[0].slice(0, -1) + ` style="${layout}">`
                );
            }
        }

        // If no container found, wrap the content in a container with layout
        if (!html.includes('class="container"')) {
            return `<div class="container" style="${layout}">${html}</div>`;
        }

        // As a last resort, apply to the first div that doesn't have layout styles
        const divMatch = html.match(
            /<div(?![^>]*(?:flex|grid|gap|justify-content))[^>]*>/
        );
        if (divMatch) {
            const styleMatch = divMatch[0].match(/style="([^"]*)"/);
            if (styleMatch) {
                return html.replace(
                    styleMatch[0],
                    `style="${styleMatch[1]}; ${layout}"`
                );
            } else {
                return html.replace(
                    divMatch[0],
                    divMatch[0].slice(0, -1) + ` style="${layout}">`
                );
            }
        }

        return html;
    }

    private applyGameElementMutation(html: string): string {
        const gameElements = [
            `<div class="game-player" data-collision="true" data-speed="5" style="width: 32px; height: 32px; background-color: rgb(255, 0, 0); position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);">
                <script>
                    document.querySelector('.game-player').addEventListener('collision', (e) => {
                        const target = e.target;
                        if (target.classList.contains('game-powerup')) {
                            window.gameState.addPowerup(target.dataset.effect, parseInt(target.dataset.duration));
                            target.remove();
                        } else if (target.classList.contains('game-portal')) {
                            window.gameState.level++;
                            document.dispatchEvent(new CustomEvent('nextLevel', { detail: { level: window.gameState.level } }));
                        }
                    });
                </script>
            </div>`,
            `<div class="game-score" style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; background-color: rgb(51, 51, 51); color: rgb(255, 255, 255); border-radius: 5px;">Score: 0</div>`,
            `<div class="game-collectible" data-collision="true" data-points="10" style="width: 16px; height: 16px; background-color: rgb(255, 255, 0); position: absolute; border-radius: 50%; animation: float 2s infinite ease-in-out;"></div>`,
            `<div class="game-powerup" data-collision="true" data-effect="speed" data-duration="5000" style="width: 16px; height: 16px; background-color: rgb(255, 255, 0); position: absolute; border-radius: 50%; animation: float 2s infinite ease-in-out;">
                <script>
                    document.querySelector('.game-powerup').addEventListener('collision', (e) => {
                        const powerup = e.target;
                        window.gameState.powerups.push({ effect: powerup.dataset.effect, expires: Date.now() + parseInt(powerup.dataset.duration) });
                        powerup.remove();
                    });
                </script>
            </div>`,
        ];

        const element =
            gameElements[Math.floor(Math.random() * gameElements.length)];
        const insertPoint = html.lastIndexOf("</div>");

        return insertPoint !== -1
            ? html.slice(0, insertPoint) + element + html.slice(insertPoint)
            : html + element;
    }

    private addCollisionDetection(html: string): string {
        // Add collision detection to existing game elements if they don't have it
        return html.replace(
            /class="(game-player|game-collectible|game-obstacle|game-portal|game-checkpoint)"([^>]*?)(?:data-collision="true")?([^>]*?)>/g,
            'class="$1"$2 data-collision="true"$3>'
        );
    }

    private addLevelProgression(html: string): string {
        const progressionElements = [
            `<div class="game-portal" data-collision="true" style="width: 40px; height: 40px; background: radial-gradient(circle, #4CAF50 0%, transparent 100%); position: absolute; animation: pulse 2s infinite;">
                <div class="portal-label">Next Level</div>
            </div>`,
            `<div class="game-checkpoint" data-collision="true" style="width: 32px; height: 32px; background-color: #2196F3; position: absolute; border-radius: 4px;">
                <div class="checkpoint-label">Checkpoint</div>
            </div>`,
        ];

        const element =
            progressionElements[
                Math.floor(Math.random() * progressionElements.length)
            ];
        const insertPosition = html.lastIndexOf("</div>");
        return insertPosition !== -1
            ? html.slice(0, insertPosition) +
                  element +
                  html.slice(insertPosition)
            : html + element;
    }

    private addGameMechanics(html: string): string {
        // Ensure all game elements have collision detection
        let updatedHtml = this.addCollisionDetection(html);

        // Add level progression elements if not present
        if (
            !updatedHtml.includes("game-portal") &&
            !updatedHtml.includes("game-checkpoint")
        ) {
            updatedHtml = this.addLevelProgression(updatedHtml);
        }

        // Insert all elements before closing body tag
        const insertPosition = updatedHtml.lastIndexOf("</div>");
        if (insertPosition === -1) return updatedHtml;

        // Add game state management and controls
        const gameElements = `
            <script>
                // Game state management
                window.gameState = {
                    score: 0,
                    health: 100,
                    level: 1,
                    powerups: [],
                    combo: 0,
                    updateScore: function(points) {
                        this.score += points * (this.combo + 1);
                        document.querySelectorAll('.game-score').forEach(el => {
                            el.textContent = 'Score: ' + this.score;
                        });
                    },
                    updateHealth: function(amount) {
                        this.health = Math.max(0, Math.min(100, this.health + amount));
                        document.querySelectorAll('.health-bar').forEach(el => {
                            el.style.width = this.health + '%';
                        });
                        if (this.health <= 0) this.gameOver();
                    },
                    addPowerup: function(effect, duration) {
                        this.powerups.push({ effect, expires: Date.now() + duration });
                        setTimeout(() => this.removePowerup(effect), duration);
                        document.dispatchEvent(new CustomEvent('powerupAdded', { detail: { effect, duration } }));
                    },
                    removePowerup: function(effect) {
                        this.powerups = this.powerups.filter(p => p.effect !== effect);
                        document.dispatchEvent(new CustomEvent('powerupRemoved', { detail: { effect } }));
                    },
                    hasPowerup: function(effect) {
                        return this.powerups.some(p => p.effect === effect && p.expires > Date.now());
                    },
                    gameOver: function() {
                        document.dispatchEvent(new CustomEvent('gameOver', { detail: { score: this.score } }));
                    }
                };

                // Player controls
                document.addEventListener('keydown', (e) => {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;
                    const speedBoost = gameState.hasPowerup('speed') ? 2 : 1;

                    switch(e.key) {
                        case 'ArrowLeft':
                            player.style.left = (parseInt(player.style.left || '0') - speed * speedBoost) + 'px';
                            break;
                        case 'ArrowRight':
                            player.style.left = (parseInt(player.style.left || '0') + speed * speedBoost) + 'px';
                            break;
                        case 'ArrowUp':
                            player.style.top = (parseInt(player.style.top || '0') - speed * speedBoost) + 'px';
                            break;
                        case 'ArrowDown':
                            player.style.top = (parseInt(player.style.top || '0') + speed * speedBoost) + 'px';
                            break;
                        case ' ':
                            player.dispatchEvent(new CustomEvent('action'));
                            break;
                    }
                    checkCollisions();
                });

                // Mobile controls
                const controls = document.createElement('div');
                controls.className = 'game-controls';
                controls.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px;';

                // Create left button
                const leftBtn = document.createElement('button');
                leftBtn.className = 'control-left';
                leftBtn.textContent = '←';
                leftBtn.addEventListener('touchstart', () => movePlayer('left'));
                leftBtn.addEventListener('touchend', stopPlayer);

                // Create right button
                const rightBtn = document.createElement('button');
                rightBtn.className = 'control-right';
                rightBtn.textContent = '→';
                rightBtn.addEventListener('touchstart', () => movePlayer('right'));
                rightBtn.addEventListener('touchend', stopPlayer);

                // Create action button
                const actionBtn = document.createElement('button');
                actionBtn.className = 'control-action';
                actionBtn.textContent = 'Action';
                actionBtn.addEventListener('touchstart', playerAction);

                // Add buttons to controls
                controls.appendChild(leftBtn);
                controls.appendChild(rightBtn);
                controls.appendChild(actionBtn);

                document.body.appendChild(controls);

                // Game mechanics
                function checkCollisions() {
                    const player = document.querySelector('.game-player');
                    if (!player) return;

                    document.querySelectorAll('[data-collision="true"]').forEach(element => {
                        if (element === player) return;

                        const rect1 = player.getBoundingClientRect();
                        const rect2 = element.getBoundingClientRect();

                        if (!(rect1.right < rect2.left ||
                            rect1.left > rect2.right ||
                            rect1.bottom < rect2.top ||
                            rect1.top > rect2.bottom)) {

                            element.dispatchEvent(new CustomEvent('collision', { detail: { player } }));

                            if (element.classList.contains('game-collectible')) {
                                gameState.updateScore(parseInt(element.dataset.points || '10'));
                                element.remove();
                            } else if (element.classList.contains('game-obstacle')) {
                                gameState.updateHealth(-parseInt(element.dataset.damage || '20'));
                            } else if (element.classList.contains('game-portal')) {
                                gameState.level++;
                                document.dispatchEvent(new CustomEvent('nextLevel', { detail: { level: gameState.level } }));
                            } else if (element.classList.contains('game-checkpoint')) {
                                document.dispatchEvent(new CustomEvent('checkpoint'));
                            } else if (element.classList.contains('game-powerup')) {
                                gameState.addPowerup(element.dataset.effect, parseInt(element.dataset.duration));
                                element.remove();
                            }
                        }
                    });
                }

                function movePlayer(direction) {
                    const player = document.querySelector('.game-player');
                    if (!player) return;
                    const speed = parseInt(player.dataset.speed) || 5;
                    const speedBoost = gameState.hasPowerup('speed') ? 2 : 1;

                    switch(direction) {
                        case 'left':
                            player.style.left = (parseInt(player.style.left || '0') - speed * speedBoost) + 'px';
                            break;
                        case 'right':
                            player.style.left = (parseInt(player.style.left || '0') + speed * speedBoost) + 'px';
                            break;
                    }
                    checkCollisions();
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
                    checkCollisions();
                }

                // Start game loop
                setInterval(checkCollisions, 100);
            </script>

            <div class="game-player" data-collision="true" data-speed="5" style="width: 32px; height: 32px; background-color: rgb(255, 0, 0); position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);"></div>
            <div class="game-portal" data-collision="true" data-next-level="true" style="width: 40px; height: 40px; background: radial-gradient(circle, #4CAF50 0%, transparent 100%); position: absolute; animation: pulse 2s infinite;">
                <div class="portal-label">Next Level</div>
            </div>
            <div class="game-checkpoint" data-collision="true" data-save-point="true" style="width: 32px; height: 32px; background-color: #2196F3; position: absolute; border-radius: 4px;">
                <div class="checkpoint-label">Checkpoint</div>
            </div>
        `;

        return (
            updatedHtml.slice(0, insertPosition) +
            gameElements +
            updatedHtml.slice(insertPosition)
        );
    }
}
