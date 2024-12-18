import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { VectorDatabase, VectorSearchResult } from "./VectorDatabase";
import {
    PatternStagingService as PatternStaging,
    GamePattern,
} from "./PatternStaging";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { parse } from "node-html-parser";

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
        console.log("Initializing PatternEvolution service");
        this.runtime = runtime;

        // Create and initialize dependencies
        this.vectorDb = new VectorDatabase();
        await this.vectorDb.initialize(runtime);

        this.staging = new PatternStaging();
        await this.staging.initialize(runtime);

        console.log("PatternEvolution service initialized");
    }

    async evolvePattern(
        seedPattern: GamePattern,
        config: EvolutionConfig
    ): Promise<EvolutionResult> {
        try {
            const {
                populationSize = 4,
                generationLimit = 10,
                fitnessThreshold = 0.8,
                elitismCount = 1,
            } = config;

            // Initialize population
            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                seedPattern.embedding,
                seedPattern.type,
                0.7,
                populationSize - 1
            );

            let population = this.initializePopulation(
                seedPattern,
                similarPatterns,
                populationSize
            );

            let bestResult: EvolutionResult = {
                pattern: seedPattern,
                fitness: await this.calculateFitness(seedPattern),
                generation: 0,
            };

            // Evolution loop
            for (
                let generation = 1;
                generation <= generationLimit;
                generation++
            ) {
                // Validate and update fitness for current population
                const validatedPopulation = await Promise.all(
                    population.map(async (pattern) => {
                        const validated =
                            await this.staging.validatePattern(pattern);
                        return {
                            pattern: validated,
                            fitness: await this.calculateFitness(validated),
                        };
                    })
                );

                // Sort by fitness
                validatedPopulation.sort((a, b) => b.fitness - a.fitness);

                // Check if we've reached the fitness threshold
                if (validatedPopulation[0].fitness >= fitnessThreshold) {
                    bestResult = {
                        pattern: validatedPopulation[0].pattern,
                        fitness: validatedPopulation[0].fitness,
                        generation,
                    };
                    break;
                }

                // Select elite patterns
                const elites = validatedPopulation
                    .slice(0, elitismCount)
                    .map((p) => p.pattern);

                // Create next generation
                const nextGeneration = [...elites];

                // Fill rest with crossover and mutation
                while (nextGeneration.length < populationSize) {
                    if (Math.random() < 0.5 && population.length >= 2) {
                        const parent1 = this.selectParent(validatedPopulation);
                        const parent2 = this.selectParent(validatedPopulation);
                        const offspring = await this.crossover(
                            parent1,
                            parent2
                        );
                        nextGeneration.push(offspring);
                    } else {
                        const parent = this.selectParent(validatedPopulation);
                        const mutated = await this.mutate(parent);
                        nextGeneration.push(mutated);
                    }
                }

                population = nextGeneration;

                // Update best result if we found a better one
                const currentBest = validatedPopulation[0];
                if (currentBest.fitness > bestResult.fitness) {
                    bestResult = {
                        pattern: currentBest.pattern,
                        fitness: currentBest.fitness,
                        generation,
                    };
                }

                console.log(`Generation ${generation} complete:`, {
                    populationSize: population.length,
                    bestFitness: bestResult.fitness,
                });
            }

            // Store the best result
            await this.vectorDb.storePattern(bestResult.pattern);

            return bestResult;
        } catch (error) {
            console.error("Error during pattern evolution:", error);
            throw error;
        }
    }

    private initializePopulation(
        seedPattern: GamePattern,
        similarPatterns: VectorSearchResult[],
        size: number
    ): GamePattern[] {
        console.log("Initializing population with:", {
            seedPatternId: seedPattern?.id,
            similarPatternsCount: similarPatterns?.length,
            targetSize: size,
        });

        const population: GamePattern[] = [seedPattern];

        // Add similar patterns
        population.push(...similarPatterns.map((result) => result.pattern));

        console.log("Population after adding similar patterns:", {
            currentSize: population.length,
            patternsWithContent: population.filter((p) => p?.content?.html)
                .length,
        });

        // Fill remaining slots with mutations of existing patterns
        while (population.length < size) {
            const basePattern =
                population[Math.floor(Math.random() * population.length)];

            console.log("Creating variant from base pattern:", {
                basePatternId: basePattern?.id,
                hasContent: !!basePattern?.content,
                contentHtml: !!basePattern?.content?.html,
            });

            const variant = {
                ...basePattern,
                id: uuidv4(),
                pattern_name: `${basePattern.pattern_name}_variant_${population.length}`,
                content: {
                    ...basePattern.content,
                    html: basePattern.content.html,
                    css: basePattern.content.css || "",
                    js: basePattern.content.js || "",
                    context: basePattern.content.context || "game",
                    metadata: { ...basePattern.content.metadata },
                },
            };

            console.log("Created variant:", {
                id: variant.id,
                name: variant.pattern_name,
                hasContent: !!variant.content,
                hasHtml: !!variant.content?.html,
            });

            population.push(variant);
        }

        console.log("Final population:", {
            size: population.length,
            patternsWithContent: population.filter((p) => p?.content?.html)
                .length,
        });

        return population;
    }

    private async calculateFitness(pattern: GamePattern): Promise<number> {
        // Calculate fitness based on multiple factors
        const baseScore = pattern.effectiveness_score || 0;
        const complexityScore = this.calculateComplexityScore(pattern);
        const interactivityScore = this.calculateInteractivityScore(pattern);
        const gameplayScore = this.calculateGameplayScore(pattern);

        // Weighted combination of scores
        return (
            baseScore * 0.3 +
            complexityScore * 0.2 +
            interactivityScore * 0.2 +
            gameplayScore * 0.3
        );
    }

    private calculateComplexityScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";
        const hasCollisions = /collision|intersect|overlap/.test(html);
        const hasGameState = /gameState|score|level/.test(html);
        const hasAnimations = /@keyframes|animation|transition/.test(html);
        const hasLayout = /flex|grid|gap|justify-content/.test(html);

        let score = 0;
        if (hasCollisions) score += 0.25;
        if (hasGameState) score += 0.25;
        if (hasAnimations) score += 0.25;
        if (hasLayout) score += 0.25;

        return score;
    }

    private calculateInteractivityScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";
        const hasControls = /keydown|click|mousedown/.test(html);
        const hasPowerUps = /power-up|boost|upgrade/.test(html);
        const hasEvents = /addEventListener|on\w+="/.test(html);
        const hasDraggable = /draggable|drag/.test(html);

        let score = 0;
        if (hasControls) score += 0.25;
        if (hasPowerUps) score += 0.25;
        if (hasEvents) score += 0.25;
        if (hasDraggable) score += 0.25;

        return score;
    }

    private calculateGameplayScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";
        const hasLevels = /level|stage|phase/.test(html);
        const hasScoring = /score|points|highscore/.test(html);
        const hasGameLoop = /setInterval|requestAnimationFrame/.test(html);
        const hasGameEvents = /gameOver|levelUp|powerUp/.test(html);

        let score = 0;
        if (hasLevels) score += 0.25;
        if (hasScoring) score += 0.25;
        if (hasGameLoop) score += 0.25;
        if (hasGameEvents) score += 0.25;

        return score;
    }

    private selectParent(
        evaluatedPopulation: { pattern: GamePattern; fitness: number }[]
    ): GamePattern {
        // Tournament selection
        const tournamentSize = 3;
        const tournament = Array(tournamentSize)
            .fill(0)
            .map(
                () =>
                    evaluatedPopulation[
                        Math.floor(Math.random() * evaluatedPopulation.length)
                    ]
            );

        tournament.sort((a, b) => b.fitness - a.fitness);

        console.log("Parent selection:", {
            tournamentSize,
            selectedPatternId: tournament[0].pattern.id,
            selectedFitness: tournament[0].fitness,
        });

        return tournament[0].pattern;
    }

    private async mutate(pattern: GamePattern): Promise<GamePattern> {
        const mutationOperators = [
            "add_interaction",
            "modify_style",
            "add_animation",
            "change_layout",
            "add_game_element",
            "add_collision_detection",
            "add_power_ups",
            "add_game_state",
            "add_level_progression",
        ];

        const html = pattern.content?.html || "";
        const $ = parse(html);

        // Ensure game container exists
        if (!$.querySelector(".game-container")) {
            const container = parse('<div class="game-container"></div>');
            $.querySelector("body")?.appendChild(container);
        }

        // Apply random number of mutations (2-4)
        const mutationCount = Math.floor(Math.random() * 3) + 2;
        console.log(`Applying ${mutationCount} mutations`);

        for (let i = 0; i < mutationCount; i++) {
            const operator =
                mutationOperators[
                    Math.floor(Math.random() * mutationOperators.length)
                ];
            switch (operator) {
                case "add_collision_detection":
                    if (!html.includes("checkCollisions")) {
                        const collisionScript = `
                            <script>
                                function checkCollisions() {
                                    const player = document.querySelector('.player');
                                    const elements = document.querySelectorAll('.enemy, .power-up');
                                    elements.forEach(element => {
                                        if (isColliding(player, element)) {
                                            dispatchEvent(new CustomEvent('collision', {
                                                detail: { type: element.className }
                                            }));
                                        }
                                    });
                                }
                                function isColliding(a, b) {
                                    const aRect = a.getBoundingClientRect();
                                    const bRect = b.getBoundingClientRect();
                                    return !(
                                        aRect.top + aRect.height < bRect.top ||
                                        aRect.top > bRect.top + bRect.height ||
                                        aRect.left + aRect.width < bRect.left ||
                                        aRect.left > bRect.left + bRect.width
                                    );
                                }
                                setInterval(checkCollisions, 100);
                            </script>
                        `;
                        $.querySelector("body")?.appendChild(
                            parse(collisionScript)
                        );
                    }
                    break;

                case "add_power_ups":
                    if (!html.includes("power-up")) {
                        const powerUpElement = `
                            <div class="power-up" data-effect="speed" data-duration="5000"></div>
                            <script>
                                function handlePowerUp(effect, duration) {
                                    const player = document.querySelector('.player');
                                    player.classList.add(effect);
                                    updateGameState('powerUps', [...gameState.powerUps, { effect, duration }]);
                                    setTimeout(() => {
                                        player.classList.remove(effect);
                                        updateGameState('powerUps', gameState.powerUps.filter(p => p.effect !== effect));
                                    }, duration);
                                }
                            </script>
                        `;
                        $.querySelector(".game-container")?.appendChild(
                            parse(powerUpElement)
                        );
                    }
                    break;

                case "add_game_state":
                    if (!html.includes("gameState")) {
                        const gameStateScript = `
                            <script>
                                let gameState = {
                                    score: 0,
                                    level: 1,
                                    powerUps: [],
                                    health: 100
                                };

                                function updateGameState(key, value) {
                                    gameState[key] = value;
                                    dispatchEvent(new CustomEvent('gameStateUpdate', {
                                        detail: { key, value }
                                    }));
                                }
                            </script>
                        `;
                        $.querySelector("body")?.appendChild(
                            parse(gameStateScript)
                        );
                    }
                    break;

                case "add_level_progression":
                    if (!html.includes("levelUp")) {
                        const levelScript = `
                            <div class="level-display">Level 1</div>
                            <script>
                                function levelUp() {
                                    updateGameState('level', gameState.level + 1);
                                    dispatchEvent(new CustomEvent('levelUp', {
                                        detail: { level: gameState.level }
                                    }));
                                }

                                function checkLevelProgress() {
                                    if (gameState.score >= gameState.level * 1000) {
                                        levelUp();
                                    }
                                }
                                setInterval(checkLevelProgress, 1000);
                            </script>
                        `;
                        $.querySelector(".game-container")?.appendChild(
                            parse(levelScript)
                        );
                    }
                    break;

                case "add_game_element":
                    const elements = [
                        '<div class="player" onkeydown="handleMovement()"></div>',
                        '<div class="enemy" data-speed="2"></div>',
                        '<div class="collectible" data-points="10"></div>',
                    ];
                    const element =
                        elements[Math.floor(Math.random() * elements.length)];
                    $.querySelector(".game-container")?.appendChild(
                        parse(element)
                    );
                    break;

                case "change_layout":
                    const layoutStyles = [
                        "display: flex; flex-direction: column; gap: 1rem;",
                        "display: flex; justify-content: space-between; align-items: center;",
                        "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px;",
                        'display: grid; grid-template-areas: "header header" "nav main" "footer footer"; gap: 10px;',
                    ];
                    const selectedLayout =
                        layoutStyles[
                            Math.floor(Math.random() * layoutStyles.length)
                        ];
                    const targetElement = $.querySelector(".game-container");
                    if (targetElement) {
                        const currentStyle =
                            targetElement.getAttribute("style") || "";
                        targetElement.setAttribute(
                            "style",
                            `${currentStyle}; ${selectedLayout}`
                        );
                    }
                    break;

                case "add_interaction":
                    if (!html.includes("handleMovement")) {
                        const movementScript = `
                            <script>
                                function handleMovement(event) {
                                    const player = document.querySelector('.player');
                                    const speed = 5;
                                    switch(event.key) {
                                        case 'ArrowLeft': player.style.left = (player.offsetLeft - speed) + 'px'; break;
                                        case 'ArrowRight': player.style.left = (player.offsetLeft + speed) + 'px'; break;
                                        case 'ArrowUp': player.style.top = (player.offsetTop - speed) + 'px'; break;
                                        case 'ArrowDown': player.style.top = (player.offsetTop + speed) + 'px'; break;
                                    }
                                }
                                document.addEventListener('keydown', handleMovement);
                            </script>
                        `;
                        $.querySelector("body")?.appendChild(
                            parse(movementScript)
                        );
                    }
                    break;

                case "add_animation":
                    const animations = [
                        "@keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }",
                        "@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }",
                        "@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }",
                    ];
                    const animation =
                        animations[
                            Math.floor(Math.random() * animations.length)
                        ];
                    const styleElement =
                        $.querySelector("style") || parse("<style></style>");
                    styleElement.textContent += animation;
                    if (!$.querySelector("style")) {
                        $.querySelector("head")?.appendChild(styleElement);
                    }
                    break;

                case "modify_style":
                    const styles = [
                        "border: 2px solid #333; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); margin: 10px;",
                        "background-color: #f0f0f0; border-radius: 4px; padding: 10px;",
                        "position: relative; overflow: hidden; min-height: 200px;",
                    ];
                    const style =
                        styles[Math.floor(Math.random() * styles.length)];
                    const element = $.querySelector(".game-container");
                    if (element) {
                        const currentStyle =
                            element.getAttribute("style") || "";
                        element.setAttribute(
                            "style",
                            `${currentStyle}; ${style}`
                        );
                    }
                    break;
            }
        }

        return {
            ...pattern,
            content: {
                ...pattern.content,
                html: $.toString(),
            },
        };
    }

    private async crossover(
        parent1: GamePattern,
        parent2: GamePattern
    ): Promise<GamePattern> {
        console.log("Starting crossover:", {
            parent1Id: parent1.id,
            parent2Id: parent2.id,
        });

        if (!parent1?.content?.html || !parent2?.content?.html) {
            console.warn("Cannot perform crossover - missing content:", {
                parent1HasContent: !!parent1?.content?.html,
                parent2HasContent: !!parent2?.content?.html,
            });
            return parent1;
        }

        try {
            const dom1 = new JSDOM(parent1.content.html);
            const dom2 = new JSDOM(parent2.content.html);

            // Swap some elements between parents
            const elements1 =
                dom1.window.document.querySelectorAll(".game-element");
            const elements2 =
                dom2.window.document.querySelectorAll(".game-element");

            if (elements1.length > 0 && elements2.length > 0) {
                const swapIndex = Math.floor(
                    Math.random() * Math.min(elements1.length, elements2.length)
                );
                const temp = elements1[swapIndex].cloneNode(true);
                elements1[swapIndex].replaceWith(
                    elements2[swapIndex].cloneNode(true)
                );
                elements2[swapIndex].replaceWith(temp);
            }

            const offspring: GamePattern = {
                ...parent1,
                id: uuidv4(),
                pattern_name: `${parent1.pattern_name}_${parent2.pattern_name}_offspring`,
                content: {
                    ...parent1.content,
                    html: dom1.serialize(),
                },
            };

            console.log("Crossover complete:", {
                parent1Id: parent1.id,
                parent2Id: parent2.id,
                offspringId: offspring.id,
            });

            return offspring;
        } catch (error) {
            console.error("Error during crossover:", {
                parent1Id: parent1.id,
                parent2Id: parent2.id,
                error: error.message,
            });
            return parent1;
        }
    }

    private async mutateColors(document: Document): Promise<void> {
        console.log("Applying color mutation");
        const styles = document.querySelectorAll("style");
        styles.forEach((style) => {
            if (style.textContent) {
                // Replace colors with new random colors
                style.textContent = style.textContent.replace(
                    /#[0-9a-f]{6}/gi,
                    () =>
                        `#${Math.floor(Math.random() * 16777215)
                            .toString(16)
                            .padStart(6, "0")}`
                );
                // Add new color properties
                const elements = document.querySelectorAll(".game-element");
                elements.forEach((element) => {
                    const color = `#${Math.floor(Math.random() * 16777215)
                        .toString(16)
                        .padStart(6, "0")}`;
                    style.textContent += `\n.${element.className.split(" ")[0]} { color: ${color}; border-color: ${color}; }`;
                });
            }
        });
    }

    private async mutateAnimations(document: Document): Promise<void> {
        console.log("Applying animation mutation");
        const styles = document.querySelectorAll("style");
        const animations = [
            {
                name: "bounce",
                keyframes:
                    "@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }",
                style: "animation: bounce VAR_DURs infinite;",
            },
            {
                name: "rotate",
                keyframes:
                    "@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }",
                style: "animation: rotate VAR_DURs infinite linear;",
            },
            {
                name: "pulse",
                keyframes:
                    "@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }",
                style: "animation: pulse VAR_DURs infinite;",
            },
            {
                name: "shake",
                keyframes:
                    "@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }",
                style: "animation: shake VAR_DURs infinite;",
            },
        ];

        styles.forEach((style) => {
            if (style.textContent) {
                // Add new animation
                const animation =
                    animations[Math.floor(Math.random() * animations.length)];
                if (
                    !style.textContent.includes(`@keyframes ${animation.name}`)
                ) {
                    style.textContent += `\n${animation.keyframes}`;
                }

                // Apply animation to elements
                const elements = document.querySelectorAll(".game-element");
                elements.forEach((element) => {
                    const duration = (Math.random() * 2 + 0.5).toFixed(1);
                    const animationStyle = animation.style.replace(
                        "VAR_DUR",
                        duration
                    );
                    style.textContent += `\n.${element.className.split(" ")[0]} { ${animationStyle} }`;
                });

                // Modify existing animation durations
                style.textContent = style.textContent.replace(
                    /animation:.*?(\d+)s/g,
                    (match, duration) =>
                        match.replace(
                            duration,
                            Math.max(0.5, Math.random() * 3).toFixed(1)
                        )
                );
            }
        });
    }

    private async mutateLayout(document: Document): Promise<void> {
        console.log("Applying layout mutation");
        const elements = document.querySelectorAll(".game-element");
        const styles = document.querySelectorAll("style");
        const layouts = [
            "position: absolute; top: VAR_POSpx; left: VAR_POSpx;",
            "position: absolute; bottom: VAR_POSpx; right: VAR_POSpx;",
            "position: absolute; transform: translate(VAR_POSpx, VAR_POSpx);",
            "position: absolute; transform: rotate(VAR_ROTdeg) translate(VAR_POSpx, VAR_POSpx);",
        ];

        elements.forEach((element) => {
            const layout = layouts[Math.floor(Math.random() * layouts.length)]
                .replace(/VAR_POS/g, () =>
                    Math.floor(Math.random() * 100).toString()
                )
                .replace(/VAR_ROT/g, () =>
                    Math.floor(Math.random() * 360).toString()
                );

            const style = element.getAttribute("style") || "";
            const newStyle =
                style
                    .replace(
                        /width:.*?;/,
                        `width: ${Math.floor(30 + Math.random() * 40)}px;`
                    )
                    .replace(
                        /height:.*?;/,
                        `height: ${Math.floor(30 + Math.random() * 40)}px;`
                    )
                    .replace(
                        /position:.*?;|top:.*?;|left:.*?;|bottom:.*?;|right:.*?;|transform:.*?;/g,
                        ""
                    ) + layout;
            element.setAttribute("style", newStyle);
        });

        // Add responsive layout styles
        styles.forEach((style) => {
            if (style.textContent && !style.textContent.includes("@media")) {
                style.textContent += `
                    @media (max-width: 768px) {
                        .game-element {
                            transform: scale(0.8);
                        }
                    }
                    @media (max-width: 480px) {
                        .game-element {
                            transform: scale(0.6);
                        }
                    }
                `;
            }
        });
    }

    private async mutateInteractivity(document: Document): Promise<void> {
        console.log("Applying interactivity mutation");
        const elements = document.querySelectorAll(".game-element");
        const interactionTypes = [
            {
                class: "interactive",
                attributes: {
                    onclick: "this.classList.toggle('active')",
                    "data-interactive": "true",
                },
                style: ".interactive:hover { cursor: pointer; transform: scale(1.1); transition: transform 0.2s; }",
            },
            {
                class: "draggable",
                attributes: {
                    draggable: "true",
                    ondragstart:
                        "event.dataTransfer.setData('text', event.target.id)",
                    "data-interactive": "true",
                },
                style: ".draggable:hover { cursor: move; }",
            },
            {
                class: "clickable",
                attributes: {
                    onclick: "this.style.animation = 'pulse 0.5s'",
                    "data-interactive": "true",
                },
                style: ".clickable:hover { cursor: pointer; filter: brightness(1.2); }",
            },
        ];

        elements.forEach((element) => {
            if (Math.random() < 0.5) {
                const interaction =
                    interactionTypes[
                        Math.floor(Math.random() * interactionTypes.length)
                    ];
                element.classList.add(interaction.class);
                Object.entries(interaction.attributes).forEach(
                    ([key, value]) => {
                        element.setAttribute(key, value);
                    }
                );

                // Add interaction styles
                const style = document.querySelector("style");
                if (style && !style.textContent?.includes(interaction.style)) {
                    style.textContent += `\n${interaction.style}`;
                }
            }
        });
    }
}
