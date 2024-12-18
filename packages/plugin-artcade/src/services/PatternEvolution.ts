import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { VectorDatabase, VectorSearchResult } from "./VectorDatabase";
import {
    PatternStagingService as PatternStaging,
    GamePattern,
} from "./PatternStaging";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";

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
        this.vectorDb = await runtime.getService(VectorDatabase);
        this.staging = await runtime.getService(PatternStaging);
        console.log("PatternEvolution service initialized");
    }

    async evolvePattern(
        seedPattern: GamePattern,
        config: EvolutionConfig = {}
    ): Promise<EvolutionResult> {
        console.log("Starting pattern evolution:", {
            seedPatternId: seedPattern.id,
            type: seedPattern.type,
            config,
        });

        const evolutionConfig = { ...this.defaultConfig, ...config };
        console.log("Evolution config:", evolutionConfig);

        try {
            // Find similar patterns to use as potential parents
            console.log("Finding similar patterns for evolution");
            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                seedPattern.embedding,
                seedPattern.type,
                evolutionConfig.similarityThreshold
            );
            console.log("Found similar patterns:", {
                count: similarPatterns.length,
                patterns: similarPatterns.map((p) => ({
                    id: p.pattern.id,
                    type: p.pattern.type,
                    similarity: p.similarity,
                })),
            });

            // Initialize population with seed and similar patterns
            console.log("Initializing population");
            let population = this.initializePopulation(
                seedPattern,
                similarPatterns,
                evolutionConfig.populationSize
            );
            console.log("Initial population size:", population.length);

            let bestResult: EvolutionResult = {
                pattern: seedPattern,
                fitness: await this.evaluateFitness(seedPattern),
                generation: 0,
                parentIds: [],
            };
            console.log("Initial best result:", {
                fitness: bestResult.fitness,
                patternId: bestResult.pattern.id,
            });

            // Evolution loop
            for (
                let generation = 1;
                generation <= evolutionConfig.generationLimit;
                generation++
            ) {
                console.log(`Starting generation ${generation}`);

                // Evaluate fitness for current population
                console.log("Evaluating population fitness");
                const evaluatedPopulation = await Promise.all(
                    population.map(async (pattern) => {
                        const fitness = await this.evaluateFitness(pattern);
                        console.log("Pattern fitness:", {
                            id: pattern.id,
                            fitness,
                        });
                        return { pattern, fitness };
                    })
                );

                // Sort by fitness
                evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);
                console.log(
                    "Population sorted by fitness:",
                    evaluatedPopulation.map((p) => ({
                        id: p.pattern.id,
                        fitness: p.fitness,
                    }))
                );

                // Check if we've found a better solution
                if (evaluatedPopulation[0].fitness > bestResult.fitness) {
                    console.log("Found better solution:", {
                        oldFitness: bestResult.fitness,
                        newFitness: evaluatedPopulation[0].fitness,
                        patternId: evaluatedPopulation[0].pattern.id,
                    });

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
                        console.log(
                            "Reached fitness threshold, stopping evolution"
                        );
                        break;
                    }
                }

                // Create next generation
                console.log("Creating next generation");
                const nextGeneration: GamePattern[] = [];

                // Elitism - carry over best patterns
                for (let i = 0; i < evolutionConfig.elitismCount; i++) {
                    nextGeneration.push(evaluatedPopulation[i].pattern);
                }
                console.log(
                    "Added elite patterns:",
                    evolutionConfig.elitismCount
                );

                // Fill rest of population with offspring
                while (nextGeneration.length < evolutionConfig.populationSize) {
                    if (Math.random() < evolutionConfig.crossoverRate) {
                        // Crossover
                        console.log("Performing crossover");
                        const parent1 = this.selectParent(evaluatedPopulation);
                        const parent2 = this.selectParent(evaluatedPopulation);
                        const offspring = await this.crossover(
                            parent1,
                            parent2
                        );
                        nextGeneration.push(offspring);
                    } else {
                        // Mutation
                        console.log("Performing mutation");
                        const parent = this.selectParent(evaluatedPopulation);
                        const offspring = await this.mutate(
                            parent,
                            evolutionConfig.mutationRate
                        );
                        nextGeneration.push(offspring);
                    }
                }

                population = nextGeneration;
                console.log(`Generation ${generation} complete:`, {
                    populationSize: population.length,
                    bestFitness: bestResult.fitness,
                });
            }

            // Store the best result in the vector database
            console.log("Storing best result:", {
                id: bestResult.pattern.id,
                fitness: bestResult.fitness,
                generation: bestResult.generation,
            });
            await this.vectorDb.storePattern(bestResult.pattern);

            return bestResult;
        } catch (error) {
            console.error("Error during pattern evolution:", {
                error: error.message,
                stack: error.stack,
            });
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

    private async evaluateFitness(pattern: GamePattern): Promise<number> {
        console.log("Evaluating fitness for pattern:", pattern.id);

        if (!pattern?.content?.html) {
            console.warn("Pattern missing content or HTML:", {
                id: pattern?.id,
                hasContent: !!pattern?.content,
            });
            return 0;
        }

        // Combine multiple fitness metrics
        const metrics = await Promise.all([
            this.evaluateComplexity(pattern),
            this.evaluateInteractivity(pattern),
            this.evaluateVisualAppeal(pattern),
            this.evaluatePerformance(pattern),
        ]);

        // Weighted average of metrics
        const weights = [0.3, 0.3, 0.2, 0.2];
        const fitness = metrics.reduce(
            (sum, metric, i) => sum + metric * weights[i],
            0
        );

        console.log("Fitness evaluation complete:", {
            patternId: pattern.id,
            metrics,
            weights,
            finalFitness: fitness,
        });

        return fitness;
    }

    private async evaluateComplexity(pattern: GamePattern): Promise<number> {
        console.log("Evaluating complexity for pattern:", pattern.id);
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
            score += Math.min(maxDepth / 5, 0.25); // Max 0.25 for depth
        }

        console.log("Complexity evaluation:", {
            patternId: pattern.id,
            score,
            maxScore,
        });

        return Math.min(score, maxScore);
    }

    private async evaluateInteractivity(pattern: GamePattern): Promise<number> {
        console.log("Evaluating interactivity for pattern:", pattern.id);
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Check for event listeners
        if (content.js) {
            const eventListenerCount = (
                content.js.match(/addEventListener/g) || []
            ).length;
            score += Math.min(eventListenerCount / 5, 0.5);
        }

        // Check for interactive elements
        if (content.html) {
            const interactiveElements = (
                content.html.match(/<button|<input|<select|<a /g) || []
            ).length;
            score += Math.min(interactiveElements / 3, 0.5);
        }

        console.log("Interactivity evaluation:", {
            patternId: pattern.id,
            score,
            maxScore,
        });

        return Math.min(score, maxScore);
    }

    private async evaluateVisualAppeal(pattern: GamePattern): Promise<number> {
        console.log("Evaluating visual appeal for pattern:", pattern.id);
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Check for animations
        if (content.html) {
            const hasAnimation =
                content.html.includes("@keyframes") ||
                content.html.includes("animation:");
            if (hasAnimation) score += 0.3;
        }

        // Check for color variety
        if (content.metadata?.color_scheme) {
            score += Math.min(content.metadata.color_scheme.length / 4, 0.3);
        }

        // Check for responsive design
        if (content.html) {
            const hasMediaQueries = content.html.includes("@media");
            if (hasMediaQueries) score += 0.4;
        }

        console.log("Visual appeal evaluation:", {
            patternId: pattern.id,
            score,
            maxScore,
        });

        return Math.min(score, maxScore);
    }

    private async evaluatePerformance(pattern: GamePattern): Promise<number> {
        console.log("Evaluating performance for pattern:", pattern.id);
        const content = pattern.content;
        if (!content) return 0;

        let score = 1; // Start with perfect score and deduct based on issues
        const maxScore = 1;

        // Check HTML size
        if (content.html) {
            const sizeKB = content.html.length / 1024;
            if (sizeKB > 50) score -= 0.3;
            else if (sizeKB > 20) score -= 0.1;
        }

        // Check for expensive operations in JS
        if (content.js) {
            const hasExpensiveOps =
                content.js.includes("while") || content.js.includes("for");
            if (hasExpensiveOps) score -= 0.2;
        }

        // Check for large inline styles
        if (content.html) {
            const inlineStyleCount = (content.html.match(/style="/g) || [])
                .length;
            if (inlineStyleCount > 10) score -= 0.2;
        }

        console.log("Performance evaluation:", {
            patternId: pattern.id,
            score: Math.max(0, score),
            maxScore,
        });

        return Math.max(0, Math.min(score, maxScore));
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

    private async mutate(
        pattern: GamePattern,
        mutationRate: number
    ): Promise<GamePattern> {
        console.log("Starting mutation:", {
            patternId: pattern.id,
            mutationRate,
        });

        if (!pattern?.content?.html) {
            console.warn("Cannot mutate pattern without content:", pattern.id);
            return pattern;
        }

        try {
            const dom = new JSDOM(pattern.content.html);
            const document = dom.window.document;

            // List of possible mutations
            const mutations = [
                this.mutateColors.bind(this),
                this.mutateAnimations.bind(this),
                this.mutateLayout.bind(this),
            ];

            // Apply random mutations based on mutation rate
            for (const mutation of mutations) {
                if (Math.random() < mutationRate) {
                    console.log(`Applying mutation: ${mutation.name}`);
                    await mutation(document);
                }
            }

            const mutatedPattern: GamePattern = {
                ...pattern,
                id: uuidv4(),
                pattern_name: `${pattern.pattern_name}_mutated`,
                content: {
                    ...pattern.content,
                    html: dom.serialize(),
                },
            };

            console.log("Mutation complete:", {
                originalId: pattern.id,
                mutatedId: mutatedPattern.id,
            });

            return mutatedPattern;
        } catch (error) {
            console.error("Error during mutation:", {
                patternId: pattern.id,
                error: error.message,
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
        const styles = document.querySelectorAll("style");
        styles.forEach((style) => {
            if (style.textContent) {
                style.textContent = style.textContent.replace(
                    /#[0-9a-f]{6}/gi,
                    () =>
                        `#${Math.floor(Math.random() * 16777215)
                            .toString(16)
                            .padStart(6, "0")}`
                );
            }
        });
    }

    private async mutateAnimations(document: Document): Promise<void> {
        const styles = document.querySelectorAll("style");
        styles.forEach((style) => {
            if (style.textContent) {
                // Modify animation duration
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
        const elements = document.querySelectorAll(".game-element");
        elements.forEach((element) => {
            const style = element.getAttribute("style") || "";
            const newStyle = style
                .replace(
                    /width:.*?;/,
                    `width: ${Math.floor(30 + Math.random() * 40)}px;`
                )
                .replace(
                    /height:.*?;/,
                    `height: ${Math.floor(30 + Math.random() * 40)}px;`
                );
            element.setAttribute("style", newStyle);
        });
    }
}
