import { FitnessEvaluator, FitnessScores, HTMLOrganism } from "./types";
import { JSDOM } from "jsdom";

function createDOM(html: string): JSDOM {
    return new JSDOM(`<!DOCTYPE html><div id="root">${html}</div>`);
}

function getAllElements(dom: JSDOM): HTMLElement[] {
    return Array.from(
        dom.window.document.querySelectorAll("*")
    ) as HTMLElement[];
}

export class ArcadeFitnessEvaluator implements FitnessEvaluator {
    async evaluate(organism: HTMLOrganism): Promise<FitnessScores> {
        const dom = createDOM(organism.html);
        const elements = getAllElements(dom);

        const interactivity = this.evaluateInteractivity(elements);
        const complexity = this.evaluateComplexity(elements);
        const performance = this.evaluatePerformance(elements);
        const entertainment = this.evaluateEntertainment(elements);
        const novelty = this.evaluateNovelty(elements);

        const total =
            interactivity * 0.3 +
            complexity * 0.15 +
            performance * 0.2 +
            entertainment * 0.25 +
            novelty * 0.1;

        return {
            interactivity,
            complexity,
            performance,
            entertainment,
            novelty,
            total,
        };
    }

    private evaluateInteractivity(elements: HTMLElement[]): number {
        let score = 0;
        const totalElements = elements.length;

        if (totalElements === 0) return 0;

        // Check for interactive attributes
        const interactiveAttributes = [
            "onclick",
            "onmouseover",
            "onmouseout",
            "ondragstart",
            "ondragend",
            "draggable",
        ];

        elements.forEach((element) => {
            // Score interactive attributes
            interactiveAttributes.forEach((attr) => {
                if (element.hasAttribute(attr)) score += 1;
            });

            // Score interactive classes
            const classes = element.classList;
            ["interactive", "hoverable", "draggable", "clickable"].forEach(
                (cls) => {
                    if (classes.contains(cls)) score += 0.5;
                }
            );

            // Score game-related elements
            if (element.classList.contains("game-score")) score += 2;
            if (element.classList.contains("game-player")) score += 2;
            if (element.classList.contains("game-collectible")) score += 1;
        });

        return Math.min(score / (totalElements * 2), 1);
    }

    private evaluateComplexity(elements: HTMLElement[]): number {
        let score = 0;
        const totalElements = elements.length;

        if (totalElements === 0) return 0;

        elements.forEach((element) => {
            // Score element depth
            let depth = 0;
            let parent = element.parentElement;
            while (parent) {
                depth++;
                parent = parent.parentElement;
            }
            score += Math.min(depth * 0.1, 0.5);

            // Score style complexity
            const style = element.getAttribute("style");
            if (style) {
                score += style.split(";").length * 0.1;
            }

            // Score class complexity
            score += element.classList.length * 0.1;

            // Score child complexity
            score += element.children.length * 0.1;
        });

        return Math.min(score / (totalElements * 2), 1);
    }

    private evaluatePerformance(elements: HTMLElement[]): number {
        let score = 1;
        const totalElements = elements.length;

        if (totalElements === 0) return 0;

        elements.forEach((element) => {
            // Penalize excessive nesting
            let depth = 0;
            let parent = element.parentElement;
            while (parent) {
                depth++;
                parent = parent.parentElement;
            }
            if (depth > 5) score -= 0.1;

            // Penalize excessive styles
            const style = element.getAttribute("style");
            if (style && style.split(";").length > 10) {
                score -= 0.1;
            }

            // Penalize excessive classes
            if (element.classList.length > 5) {
                score -= 0.1;
            }

            // Penalize expensive animations
            const animation = style?.match(/animation|transform/g);
            if (animation && animation.length > 2) {
                score -= 0.1;
            }
        });

        return Math.max(score, 0);
    }

    private evaluateEntertainment(elements: HTMLElement[]): number {
        let score = 0;
        const totalElements = elements.length;

        if (totalElements === 0) return 0;

        elements.forEach((element) => {
            // Score animations
            const style = element.getAttribute("style") || "";
            if (style.includes("animation")) score += 1;
            if (style.includes("transform")) score += 0.5;

            // Score game elements
            if (element.classList.contains("game-score")) score += 2;
            if (element.classList.contains("game-player")) score += 2;
            if (element.classList.contains("game-collectible")) score += 1;

            // Score interactive elements
            if (element.hasAttribute("onclick")) score += 0.5;
            if (element.hasAttribute("draggable")) score += 1;

            // Score visual effects
            if (style.includes("transition")) score += 0.5;
            if (style.includes("box-shadow")) score += 0.3;
            if (style.includes("border-radius")) score += 0.2;
        });

        return Math.min(score / (totalElements * 3), 1);
    }

    private evaluateNovelty(elements: HTMLElement[]): number {
        let score = 0;
        const totalElements = elements.length;

        if (totalElements === 0) return 0;

        // Count unique patterns
        const patterns = new Set<string>();

        elements.forEach((element) => {
            // Record style patterns
            const style = element.getAttribute("style");
            if (style) {
                style.split(";").forEach((rule) => {
                    patterns.add(rule.trim());
                });
            }

            // Record class patterns
            element.classList.forEach((cls) => {
                patterns.add(cls);
            });

            // Record interaction patterns
            const interactions = element
                .getAttributeNames()
                .filter((attr) => attr.startsWith("on"))
                .map((attr) => element.getAttribute(attr));
            interactions.forEach((interaction) => {
                if (interaction) patterns.add(interaction);
            });
        });

        // Score based on unique patterns
        score = patterns.size / (totalElements * 2);

        return Math.min(score, 1);
    }
}
