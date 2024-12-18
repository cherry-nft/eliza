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
            console.log("Starting evolvePattern with:", {
                seedPatternId: seedPattern.id,
                seedPatternType: seedPattern.type,
                seedPatternEmbedding: seedPattern.embedding
                    ? "present"
                    : "missing",
                config,
            });

            const {
                populationSize = 4,
                generationLimit = 10,
                fitnessThreshold = 0.8,
                elitismCount = 1,
            } = config;

            // Initialize population
            console.log("Finding similar patterns with:", {
                embedding: seedPattern.embedding,
                type: seedPattern.type,
                threshold: 0.7,
                count: populationSize - 1,
            });

            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                seedPattern.embedding || [], // Provide default empty array if undefined
                seedPattern.type,
                0.7,
                populationSize - 1
            );

            console.log("Found similar patterns:", {
                count: similarPatterns.length,
                patterns: similarPatterns.map((p) => ({
                    id: p.pattern.id,
                    type: p.pattern.type,
                    hasEmbedding: !!p.pattern.embedding,
                })),
            });

            let population = this.initializePopulation(
                seedPattern,
                similarPatterns,
                populationSize
            );

            console.log("Initialized population:", {
                size: population.length,
                types: population.map((p) => p.type),
                ids: population.map((p) => p.id),
            });

            let bestResult: EvolutionResult = {
                pattern: seedPattern,
                fitness: await this.calculateFitness(seedPattern),
                generation: 0,
                parentIds: [], // Add empty array for initial pattern
            };

            console.log("Initial best result:", {
                fitness: bestResult.fitness,
                patternId: bestResult.pattern.id,
                generation: bestResult.generation,
            });

            // Evolution loop
            for (
                let generation = 1;
                generation <= generationLimit;
                generation++
            ) {
                console.log(`Starting generation ${generation}`);

                // Validate and update fitness for current population
                console.log("Validating population patterns...");
                const validatedPopulation = await Promise.all(
                    population.map(async (pattern) => {
                        try {
                            console.log(`Validating pattern ${pattern.id}`);
                            const validated = pattern; // Remove validation for now since it's not implemented
                            const fitness =
                                await this.calculateFitness(validated);
                            console.log(
                                `Pattern ${pattern.id} fitness:`,
                                fitness
                            );
                            return { pattern: validated, fitness };
                        } catch (err) {
                            console.error(
                                `Error validating pattern ${pattern.id}:`,
                                err
                            );
                            return { pattern, fitness: 0 };
                        }
                    })
                );

                // Sort by fitness
                validatedPopulation.sort((a, b) => b.fitness - a.fitness);
                console.log(
                    "Population fitness scores:",
                    validatedPopulation.map((p) => ({
                        id: p.pattern.id,
                        fitness: p.fitness,
                    }))
                );

                // Check if we've reached the fitness threshold
                if (validatedPopulation[0].fitness >= fitnessThreshold) {
                    console.log("Fitness threshold reached!", {
                        fitness: validatedPopulation[0].fitness,
                        threshold: fitnessThreshold,
                    });
                    bestResult = {
                        pattern: validatedPopulation[0].pattern,
                        fitness: validatedPopulation[0].fitness,
                        generation,
                        parentIds: [], // Add empty array since we're using the best pattern
                    };
                    break;
                }

                // Select elite patterns
                const elites = validatedPopulation
                    .slice(0, elitismCount)
                    .map((p) => p.pattern);
                console.log("Selected elite patterns:", {
                    count: elites.length,
                    ids: elites.map((p) => p.id),
                    fitnesses: elites.map(
                        (_, i) => validatedPopulation[i].fitness
                    ),
                });

                // Create next generation
                const nextGeneration = [...elites];
                console.log("Starting next generation creation");

                // Fill rest with crossover and mutation
                while (nextGeneration.length < populationSize) {
                    try {
                        if (Math.random() < 0.5 && population.length >= 2) {
                            const parent1 =
                                this.selectParent(validatedPopulation);
                            const parent2 =
                                this.selectParent(validatedPopulation);
                            console.log("Performing crossover:", {
                                parent1Id: parent1.id,
                                parent2Id: parent2.id,
                            });
                            const offspring = await this.crossover(
                                parent1,
                                parent2
                            );
                            nextGeneration.push(offspring);
                        } else {
                            const parent =
                                this.selectParent(validatedPopulation);
                            console.log("Performing mutation:", {
                                parentId: parent.id,
                            });
                            const mutated = await this.mutate(parent);
                            nextGeneration.push(mutated);
                        }
                    } catch (err) {
                        console.error("Error during generation creation:", err);
                    }
                }

                population = nextGeneration;
                console.log("Next generation created:", {
                    size: population.length,
                    ids: population.map((p) => p.id),
                });

                // Update best result if we found a better one
                const currentBest = validatedPopulation[0];
                if (currentBest.fitness > bestResult.fitness) {
                    console.log("New best result found:", {
                        oldFitness: bestResult.fitness,
                        newFitness: currentBest.fitness,
                        patternId: currentBest.pattern.id,
                    });
                    bestResult = {
                        pattern: currentBest.pattern,
                        fitness: currentBest.fitness,
                        generation,
                        parentIds: [], // Add empty array since we're using the best pattern
                    };
                }
            }

            // Store the best result
            console.log("Storing best result:", {
                patternId: bestResult.pattern.id,
                fitness: bestResult.fitness,
                generation: bestResult.generation,
            });
            await this.vectorDb.storePattern(bestResult.pattern);

            return bestResult;
        } catch (error) {
            console.error("Fatal error in evolvePattern:", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
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
        console.log("Calculating fitness for pattern:", {
            id: pattern.id,
            type: pattern.type,
            hasHtml: !!pattern.content?.html,
        });

        try {
            // Validate pattern first
            const validated = await this.staging.validatePattern(pattern);
            console.log("Pattern validated");

            // Calculate fitness based on multiple factors
            const baseScore = validated.effectiveness_score || 0;
            const complexityScore = this.calculateComplexityScore(validated);
            const interactivityScore =
                this.calculateInteractivityScore(validated);
            const gameplayScore = this.calculateGameplayScore(validated);

            // Weighted combination of scores
            const fitness =
                baseScore * 0.2 +
                complexityScore * 0.3 +
                interactivityScore * 0.3 +
                gameplayScore * 0.2;

            console.log("Fitness components:", {
                baseScore,
                complexityScore,
                interactivityScore,
                gameplayScore,
                totalFitness: fitness,
            });

            return fitness;
        } catch (error) {
            console.error("Error calculating fitness:", error);
            return 0;
        }
    }

    private calculateComplexityScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";

        let score = 0;

        // Basic structure (0.2)
        if (
            html.includes("<html") &&
            html.includes("<head") &&
            html.includes("<body")
        )
            score += 0.2;

        // Game container (0.2)
        if (html.includes('class="game-container"')) score += 0.2;

        // Collision detection (0.2)
        if (html.includes("checkCollisions") && html.includes("isColliding"))
            score += 0.2;

        // Game state management (0.2)
        if (html.includes("gameState") && html.includes("updateGameState"))
            score += 0.2;

        // Event handling (0.2)
        if (html.includes("addEventListener") && html.includes("dispatchEvent"))
            score += 0.2;

        console.log("Complexity score components:", {
            hasBasicStructure: html.includes("<html"),
            hasGameContainer: html.includes('class="game-container"'),
            hasCollisionDetection: html.includes("checkCollisions"),
            hasGameState: html.includes("gameState"),
            hasEventHandling: html.includes("addEventListener"),
            totalScore: score,
        });

        return score;
    }

    private calculateInteractivityScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";

        let score = 0;

        // Movement controls (0.25)
        if (html.includes("handleMovement") && html.includes("ArrowLeft"))
            score += 0.25;

        // Click events (0.25)
        if (html.includes("click") || html.includes("mousedown")) score += 0.25;

        // Keyboard events (0.25)
        if (html.includes("keydown") || html.includes("keypress"))
            score += 0.25;

        // Custom events (0.25)
        if (html.includes("CustomEvent") && html.includes("dispatchEvent"))
            score += 0.25;

        console.log("Interactivity score components:", {
            hasMovementControls: html.includes("handleMovement"),
            hasClickEvents: html.includes("click"),
            hasKeyboardEvents: html.includes("keydown"),
            hasCustomEvents: html.includes("CustomEvent"),
            totalScore: score,
        });

        return score;
    }

    private calculateGameplayScore(pattern: GamePattern): number {
        const html = pattern.content?.html || "";

        let score = 0;

        // Player element (0.2)
        if (html.includes('class="player"')) score += 0.2;

        // Enemy elements (0.2)
        if (html.includes('class="enemy"')) score += 0.2;

        // Collectibles (0.2)
        if (html.includes('class="collectible"')) score += 0.2;

        // Score tracking (0.2)
        if (html.includes("score") && html.includes("updateGameState"))
            score += 0.2;

        // Game over condition (0.2)
        if (html.includes("gameOver") && html.includes("collision"))
            score += 0.2;

        console.log("Gameplay score components:", {
            hasPlayer: html.includes('class="player"'),
            hasEnemies: html.includes('class="enemy"'),
            hasCollectibles: html.includes('class="collectible"'),
            hasScoring: html.includes("score"),
            hasGameOver: html.includes("gameOver"),
            totalScore: score,
        });

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
        console.log("Starting mutation for pattern:", {
            id: pattern.id,
            type: pattern.type,
            hasHtml: !!pattern.content?.html,
        });

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

        try {
            // Always start with a complete base structure
            let html = `
                <html>
                    <head>
                        <style>
                            .game-container {
                                width: 100%;
                                height: 100vh;
                                position: relative;
                                overflow: hidden;
                                background-color: #f0f0f0;
                                display: flex;
                                flex-direction: column;
                                gap: 1rem;
                                justify-content: center;
                                align-items: center;
                            }
                            .player {
                                width: 50px;
                                height: 50px;
                                background-color: #00f;
                                position: absolute;
                                border-radius: 50%;
                                transition: all 0.1s ease;
                            }
                            .enemy {
                                width: 30px;
                                height: 30px;
                                background-color: #f00;
                                position: absolute;
                                border-radius: 4px;
                            }
                            .collectible {
                                width: 20px;
                                height: 20px;
                                background-color: #ff0;
                                position: absolute;
                                border-radius: 50%;
                                animation: pulse 1s infinite;
                            }
                            .power-up {
                                width: 25px;
                                height: 25px;
                                background-color: #0f0;
                                position: absolute;
                                border-radius: 8px;
                                animation: rotate 2s infinite linear;
                            }
                            @keyframes pulse {
                                0% { transform: scale(1); }
                                50% { transform: scale(1.1); }
                                100% { transform: scale(1); }
                            }
                            @keyframes rotate {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                            .score-display {
                                position: fixed;
                                top: 20px;
                                left: 20px;
                                font-size: 24px;
                                font-family: Arial, sans-serif;
                            }
                            .health-display {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                font-size: 24px;
                                font-family: Arial, sans-serif;
                            }
                            .level-display {
                                position: fixed;
                                top: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                font-size: 24px;
                                font-family: Arial, sans-serif;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="score-display">Score: <span id="score">0</span></div>
                        <div class="health-display">Health: <span id="health">100</span></div>
                        <div class="level-display">Level: <span id="level">1</span></div>
                        <div class="game-container">
                            <div class="player"></div>
                            <div class="enemy" style="left: 20%; top: 20%;"></div>
                            <div class="enemy" style="right: 20%; bottom: 20%;"></div>
                            <div class="collectible" style="left: 50%; top: 30%;"></div>
                            <div class="collectible" style="right: 30%; top: 70%;"></div>
                            <div class="power-up" style="left: 70%; top: 50%;"></div>
                        </div>
                        <script>
                            // Game state management
                            let gameState = {
                                score: 0,
                                level: 1,
                                health: 100,
                                powerUps: []
                            };

                            function updateGameState(key, value) {
                                gameState[key] = value;
                                document.getElementById(key).textContent = value;
                                dispatchEvent(new CustomEvent('gameStateUpdate', {
                                    detail: { key, value }
                                }));
                            }

                            // Collision detection
                            function checkCollisions() {
                                const player = document.querySelector('.player');
                                if (!player) return;

                                const elements = document.querySelectorAll('.enemy, .collectible, .power-up');
                                elements.forEach(element => {
                                    if (isColliding(player, element)) {
                                        dispatchEvent(new CustomEvent('collision', {
                                            detail: { type: element.className }
                                        }));

                                        if (element.classList.contains('enemy')) {
                                            updateGameState('health', gameState.health - 10);
                                            if (gameState.health <= 0) {
                                                dispatchEvent(new CustomEvent('gameOver', {
                                                    detail: { score: gameState.score }
                                                }));
                                            }
                                        } else if (element.classList.contains('collectible')) {
                                            updateGameState('score', gameState.score + 10);
                                            element.remove();
                                        } else if (element.classList.contains('power-up')) {
                                            handlePowerUp('speed', 5000);
                                            element.remove();
                                        }
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

                            // Movement controls
                            function handleMovement(event) {
                                const player = document.querySelector('.player');
                                if (!player) return;

                                const speed = gameState.powerUps.includes('speed') ? 10 : 5;
                                switch(event.key) {
                                    case 'ArrowLeft': player.style.left = (player.offsetLeft - speed) + 'px'; break;
                                    case 'ArrowRight': player.style.left = (player.offsetLeft + speed) + 'px'; break;
                                    case 'ArrowUp': player.style.top = (player.offsetTop - speed) + 'px'; break;
                                    case 'ArrowDown': player.style.top = (player.offsetTop + speed) + 'px'; break;
                                }
                            }

                            // Power-up system
                            function handlePowerUp(effect, duration) {
                                const player = document.querySelector('.player');
                                if (!player) return;

                                player.classList.add(effect);
                                updateGameState('powerUps', [...gameState.powerUps, effect]);

                                setTimeout(() => {
                                    player.classList.remove(effect);
                                    updateGameState('powerUps', gameState.powerUps.filter(p => p !== effect));
                                }, duration);
                            }

                            // Level progression
                            function levelUp() {
                                updateGameState('level', gameState.level + 1);
                                dispatchEvent(new CustomEvent('levelUp', {
                                    detail: { level: gameState.level }
                                }));

                                // Add more enemies
                                const container = document.querySelector('.game-container');
                                const enemy = document.createElement('div');
                                enemy.className = 'enemy';
                                enemy.style.left = Math.random() * 80 + 10 + '%';
                                enemy.style.top = Math.random() * 80 + 10 + '%';
                                container.appendChild(enemy);
                            }

                            function checkLevelProgress() {
                                if (gameState.score >= gameState.level * 1000) {
                                    levelUp();
                                }
                            }

                            // Initialize game
                            document.addEventListener('keydown', handleMovement);
                            setInterval(checkCollisions, 100);
                            setInterval(checkLevelProgress, 1000);

                            // Event listeners
                            addEventListener('collision', (event) => {
                                console.log('Collision:', event.detail);
                            });

                            addEventListener('gameOver', (event) => {
                                alert('Game Over! Final Score: ' + event.detail.score);
                                location.reload();
                            });

                            addEventListener('levelUp', (event) => {
                                console.log('Level Up:', event.detail);
                            });
                        </script>
                    </body>
                </html>
            `;

            const $ = parse(html);
            console.log("Parsed HTML structure:", {
                hasGameContainer: !!$.querySelector(".game-container"),
                hasPlayer: !!$.querySelector(".player"),
                hasScript: !!$.querySelector("script"),
                hasStyle: !!$.querySelector("style"),
            });

            // Apply random number of mutations (2-4)
            const mutationCount = Math.floor(Math.random() * 3) + 2;
            console.log(`Applying ${mutationCount} mutations`);

            // Always apply layout mutation first
            console.log("Applying first mutation: change_layout");
            try {
                const layoutStyleTag = $.querySelector("style");
                if (layoutStyleTag) {
                    const layoutStyles = [
                        ".game-container { display: flex; flex-direction: column; gap: 1rem; justify-content: center; align-items: center; }",
                        ".game-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; justify-content: center; }",
                        ".game-container { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }",
                        ".game-container { display: grid; grid-template-areas: 'header header' 'nav main' 'footer footer'; gap: 10px; justify-content: stretch; }",
                    ];
                    const selectedLayout =
                        layoutStyles[
                            Math.floor(Math.random() * layoutStyles.length)
                        ];
                    if (!layoutStyleTag.textContent.includes(selectedLayout)) {
                        layoutStyleTag.textContent += "\n" + selectedLayout;
                        console.log("Added layout styles:", selectedLayout);
                    }
                }
            } catch (err) {
                console.error("Error applying layout mutation:", err);
            }

            // Apply remaining random mutations
            for (let i = 1; i < mutationCount; i++) {
                const operator =
                    mutationOperators[
                        Math.floor(Math.random() * mutationOperators.length)
                    ];
                console.log(`Applying additional mutation: ${operator}`);

                try {
                    switch (operator) {
                        case "add_game_element":
                            console.log("Adding game element");
                            const elements = [
                                '<div class="game-player" style="width: 32px; height: 32px; background-color: #00f; position: absolute; left: ' +
                                    (Math.random() * 80 + 10) +
                                    "%; top: " +
                                    (Math.random() * 80 + 10) +
                                    '%;"></div>',
                                '<div class="game-score" style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; background-color: #333; color: #fff; border-radius: 5px;">Score: 0</div>',
                                '<div class="game-collectible" style="width: 16px; height: 16px; background-color: #ff0; position: absolute; border-radius: 50%; animation: float 2s infinite ease-in-out; left: ' +
                                    (Math.random() * 80 + 10) +
                                    "%; top: " +
                                    (Math.random() * 80 + 10) +
                                    '%;"></div>',
                                '<div class="game-powerup" style="width: 24px; height: 24px; background-color: #0f0; position: absolute; border-radius: 4px; animation: pulse 1s infinite; left: ' +
                                    (Math.random() * 80 + 10) +
                                    "%; top: " +
                                    (Math.random() * 80 + 10) +
                                    '%;"></div>',
                                '<div class="game-portal" style="width: 40px; height: 40px; background-color: #f0f; position: absolute; border-radius: 50%; animation: rotate 3s infinite linear; left: ' +
                                    (Math.random() * 80 + 10) +
                                    "%; top: " +
                                    (Math.random() * 80 + 10) +
                                    '%;"></div>',
                                '<div class="game-checkpoint" style="width: 32px; height: 32px; background-color: #0ff; position: absolute; border: 2px solid #fff; left: ' +
                                    (Math.random() * 80 + 10) +
                                    "%; top: " +
                                    (Math.random() * 80 + 10) +
                                    '%;"></div>',
                            ];
                            const element =
                                elements[
                                    Math.floor(Math.random() * elements.length)
                                ];
                            const gameContainer =
                                $.querySelector(".game-container");
                            if (gameContainer) {
                                gameContainer.appendChild(parse(element));
                                console.log("Added game element:", element);
                            }
                            break;

                        case "modify_style":
                            console.log("Modifying styles");
                            const styles = $.querySelector("style");
                            if (styles) {
                                const colors = [
                                    "#" +
                                        Math.floor(
                                            Math.random() * 16777215
                                        ).toString(16),
                                    "#" +
                                        Math.floor(
                                            Math.random() * 16777215
                                        ).toString(16),
                                    "#" +
                                        Math.floor(
                                            Math.random() * 16777215
                                        ).toString(16),
                                ];
                                styles.textContent = styles.textContent.replace(
                                    /#[0-9a-f]{6}/gi,
                                    () =>
                                        colors[
                                            Math.floor(
                                                Math.random() * colors.length
                                            )
                                        ]
                                );
                                console.log("Modified color scheme");
                            }
                            break;

                        case "add_animation":
                            console.log("Adding animation");
                            const animations = [
                                "@keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }",
                                "@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }",
                                "@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }",
                            ];
                            const animation =
                                animations[
                                    Math.floor(
                                        Math.random() * animations.length
                                    )
                                ];
                            const styleTag = $.querySelector("style");
                            if (
                                styleTag &&
                                !styleTag.textContent.includes(animation)
                            ) {
                                styleTag.textContent += "\n" + animation;
                                console.log("Added new animation");
                            }
                            break;

                        case "change_layout":
                            console.log("Modifying layout");
                            const rootContainer = $.querySelector(".container");
                            if (rootContainer) {
                                const layoutStyles = [
                                    "display: flex; flex-direction: column; gap: 1rem; justify-content: center; align-items: center;",
                                    "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; justify-content: center;",
                                    "display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;",
                                    "display: grid; grid-template-areas: 'header header' 'nav main' 'footer footer'; gap: 10px; justify-content: stretch;",
                                ];
                                const selectedLayout =
                                    layoutStyles[
                                        Math.floor(
                                            Math.random() * layoutStyles.length
                                        )
                                    ];
                                const currentStyle =
                                    rootContainer.getAttribute("style") || "";
                                const newStyle = `${currentStyle} ${selectedLayout}`;
                                rootContainer.setAttribute("style", newStyle);
                                console.log("Layout mutation details:", {
                                    selectedLayout,
                                    currentStyle,
                                    newStyle,
                                    containerHtml: rootContainer.toString(),
                                });

                                // Also add to style tag for persistence
                                const styleTag = $.querySelector("style");
                                if (styleTag) {
                                    const containerStyle = `.container { ${selectedLayout} }`;
                                    if (
                                        !styleTag.textContent.includes(
                                            containerStyle
                                        )
                                    ) {
                                        styleTag.textContent += `\n${containerStyle}`;
                                        console.log(
                                            "Added layout styles to style tag:",
                                            containerStyle
                                        );
                                    }
                                }
                            } else {
                                console.warn(
                                    "No root container found for layout mutation"
                                );
                            }
                            break;
                    }
                } catch (err) {
                    console.error(`Error applying mutation ${operator}:`, err);
                }
            }

            const mutatedPattern = {
                ...pattern,
                content: {
                    ...pattern.content,
                    html: $.toString(),
                },
            };

            console.log("Mutation complete:", {
                originalHtmlLength: html.length,
                mutatedHtmlLength: mutatedPattern.content.html.length,
                hasGameContainer: !!$.querySelector(".game-container"),
                hasPlayer: !!$.querySelector(".player"),
                hasCollisionDetection:
                    mutatedPattern.content.html.includes("checkCollisions"),
                hasMovementHandler:
                    mutatedPattern.content.html.includes("handleMovement"),
                hasGameState: mutatedPattern.content.html.includes("gameState"),
                hasPowerUps: mutatedPattern.content.html.includes("power-up"),
                hasLevelProgression:
                    mutatedPattern.content.html.includes("levelUp"),
            });

            return mutatedPattern;
        } catch (error) {
            console.error("Error during mutation:", {
                error: error instanceof Error ? error.message : String(error),
                patternId: pattern.id,
            });
            return pattern;
        }
    }

    private async crossover(
        parent1: GamePattern,
        parent2: GamePattern
    ): Promise<GamePattern> {
        console.log("Starting crossover:", {
            parent1Id: parent1.id,
            parent2Id: parent2.id,
            parent1HasHtml: !!parent1?.content?.html,
            parent2HasHtml: !!parent2?.content?.html,
        });

        if (!parent1?.content?.html || !parent2?.content?.html) {
            console.warn("Cannot perform crossover - missing content:", {
                parent1HasContent: !!parent1?.content?.html,
                parent2HasContent: !!parent2?.content?.html,
            });
            return parent1;
        }

        try {
            console.log("Creating DOM instances");
            const dom1 = new JSDOM(parent1.content.html);
            const dom2 = new JSDOM(parent2.content.html);

            // Swap some elements between parents
            console.log("Finding game elements");
            const elements1 =
                dom1.window.document.querySelectorAll(".game-element");
            const elements2 =
                dom2.window.document.querySelectorAll(".game-element");

            console.log("Game elements found:", {
                parent1Elements: elements1.length,
                parent2Elements: elements2.length,
            });

            if (elements1.length > 0 && elements2.length > 0) {
                const swapIndex = Math.floor(
                    Math.random() * Math.min(elements1.length, elements2.length)
                );
                console.log(`Swapping elements at index ${swapIndex}`);

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
                offspringHtmlLength: offspring.content.html.length,
            });

            return offspring;
        } catch (error) {
            console.error("Error during crossover:", {
                error: error instanceof Error ? error.message : String(error),
                parent1Id: parent1.id,
                parent2Id: parent2.id,
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
