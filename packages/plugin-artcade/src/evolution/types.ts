export interface HTMLOrganism {
    id: string;
    html: string;
    generation: number;
    fitness: FitnessScores;
    parentIds: string[];
    appliedPatterns: string[];
}

export interface FitnessScores {
    interactivity: number;
    complexity: number;
    performance: number;
    entertainment: number;
    novelty: number;
    total: number;
}

export interface EvolutionConfig {
    populationSize: number;
    maxGenerations: number;
    mutationRate: number;
    crossoverRate: number;
    elitismCount: number;
    tournamentSize: number;
}

export interface MutationOperator {
    name: string;
    weight: number;
    apply: (html: string) => Promise<string>;
}

export interface CrossoverOperator {
    name: string;
    weight: number;
    apply: (parent1: string, parent2: string) => Promise<[string, string]>;
}

export interface SelectionOperator {
    name: string;
    select: (
        population: HTMLOrganism[],
        count: number
    ) => Promise<HTMLOrganism[]>;
}

export interface EvolutionResult {
    organism: HTMLOrganism;
    history: {
        generation: number;
        bestFitness: number;
        averageFitness: number;
        population: HTMLOrganism[];
    }[];
}

export interface FitnessEvaluator {
    evaluate: (organism: HTMLOrganism) => Promise<FitnessScores>;
}

export enum MutationType {
    ADD_INTERACTION = "add_interaction",
    MODIFY_STYLE = "modify_style",
    ADD_ANIMATION = "add_animation",
    CHANGE_LAYOUT = "change_layout",
    ADD_GAME_ELEMENT = "add_game_element",
}
