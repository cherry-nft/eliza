import { FitnessEvaluator, HTMLOrganism, FitnessScores } from "./types";
import { JSDOM } from "jsdom";

export class InteractiveFitnessEvaluator implements FitnessEvaluator {
    async evaluate(organism: HTMLOrganism): Promise<FitnessScores> {
        const dom = new JSDOM(organism.html);
        const doc = dom.window.document;

        const scores: FitnessScores = {
            interactivity: this.evaluateInteractivity(doc),
            responsiveness: this.evaluateResponsiveness(doc),
            aesthetics: this.evaluateAesthetics(doc),
            performance: this.evaluatePerformance(doc),
            novelty: this.evaluateNovelty(organism),
            userInput: this.evaluateUserInput(doc),
            stateManagement: this.evaluateStateManagement(doc),
            feedback: this.evaluateFeedback(doc),
            progression: this.evaluateProgression(doc),
            gameElements: this.evaluateGameElements(doc),
            socialElements: this.evaluateSocialElements(doc),
            mediaElements: this.evaluateMediaElements(doc),
            nostalgia: this.evaluateNostalgia(doc),
            playerControl: this.evaluatePlayerControl(doc),
            collectibles: this.evaluateCollectibles(doc),
            scoring: this.evaluateScoring(doc),
            obstacles: this.evaluateObstacles(doc),
            gameLoop: this.evaluateGameLoop(doc),
            total: 0,
        };

        // Calculate weighted total
        scores.total = this.calculateWeightedTotal(scores);
        return scores;
    }

    private evaluateInteractivity(doc: Document): number {
        const interactiveElements = doc.querySelectorAll(
            "[onclick], [onmouseover], [ondrag], [draggable], [contenteditable], button, input, select, textarea"
        );
        return Math.min(1, interactiveElements.length / 5);
    }

    private evaluateResponsiveness(doc: Document): number {
        const responsiveElements = doc.querySelectorAll(
            '[style*="transition"], [style*="animation"], [style*="transform"]'
        );
        return Math.min(1, responsiveElements.length / 3);
    }

    private evaluateAesthetics(doc: Document): number {
        const styleElements = doc.querySelectorAll(
            '[style*="color"], [style*="background"], [style*="border"], [style*="shadow"], [style*="gradient"]'
        );
        return Math.min(1, styleElements.length / 8);
    }

    private evaluatePerformance(doc: Document): number {
        // Simple heuristic based on DOM complexity
        const totalElements = doc.getElementsByTagName("*").length;
        return Math.max(0, 1 - totalElements / 1000);
    }

    private evaluateNovelty(organism: HTMLOrganism): number {
        // Based on unique patterns applied
        return Math.min(1, organism.appliedPatterns.length / 5);
    }

    private evaluateUserInput(doc: Document): number {
        const inputTypes = new Set();
        doc.querySelectorAll("*").forEach((el) => {
            if (el.hasAttribute("onclick")) inputTypes.add("click");
            if (el.hasAttribute("ondrag")) inputTypes.add("drag");
            if (el.hasAttribute("onkeydown")) inputTypes.add("keyboard");
            if (el.hasAttribute("onmousemove")) inputTypes.add("mouse");
        });
        return Math.min(1, inputTypes.size / 4);
    }

    private evaluateStateManagement(doc: Document): number {
        const stateElements = doc.querySelectorAll(
            "[data-state], [data-score], [data-progress], .score, .progress, .state"
        );
        return Math.min(1, stateElements.length / 3);
    }

    private evaluateFeedback(doc: Document): number {
        const feedbackElements = doc.querySelectorAll(
            '[style*="transition"], [style*="animation"], .feedback, .alert, .notification'
        );
        return Math.min(1, feedbackElements.length / 4);
    }

    private evaluateProgression(doc: Document): number {
        const progressElements = doc.querySelectorAll(
            ".progress, .level, .score, .achievement, [data-progress], progress"
        );
        return Math.min(1, progressElements.length / 2);
    }

    private evaluateGameElements(doc: Document): number {
        const gameElements = doc.querySelectorAll(
            ".game, .player, .enemy, .collectible, .obstacle, .score, [data-game]"
        );
        return Math.min(1, gameElements.length / 5);
    }

    private evaluateSocialElements(doc: Document): number {
        const socialElements = doc.querySelectorAll(
            ".profile, .comment, .like, .share, .feed, .post, [data-social]"
        );
        return Math.min(1, socialElements.length / 4);
    }

    private evaluateMediaElements(doc: Document): number {
        const mediaElements = doc.querySelectorAll(
            'audio, video, canvas, [style*="3d"], [style*="transform-style: preserve-3d"]'
        );
        return Math.min(1, mediaElements.length / 2);
    }

    private evaluateNostalgia(doc: Document): number {
        const nostalgicElements = doc.querySelectorAll(
            ".window, .desktop, .icon, .taskbar, .start-menu, [data-retro], [data-classic]"
        );
        return Math.min(1, nostalgicElements.length / 4);
    }

    private evaluatePlayerControl(doc: Document): number {
        const playerElements = doc.querySelectorAll(
            '.game-player, [data-player], [data-control], [onkeydown], [onkeyup], [onkeypress], [style*="position: absolute"]'
        );
        const hasMovement = Array.from(playerElements).some(
            (el) =>
                el.hasAttribute("onkeydown") ||
                el.hasAttribute("onkeyup") ||
                el.hasAttribute("onkeypress") ||
                el.getAttribute("style")?.includes("position: absolute")
        );
        return Math.min(1, (playerElements.length + (hasMovement ? 1 : 0)) / 3);
    }

    private evaluateCollectibles(doc: Document): number {
        const collectibleElements = doc.querySelectorAll(
            ".collectible, .coin, .token, .power-up, .item, [data-collectible], [data-item]"
        );
        return Math.min(1, collectibleElements.length / 4);
    }

    private evaluateScoring(doc: Document): number {
        const scoreElements = doc.querySelectorAll(
            ".score, .points, [data-score], [data-points], .high-score, .game-score"
        );
        const hasScoreUpdate = Array.from(scoreElements).some(
            (el) =>
                el.hasAttribute("onclick") ||
                el.parentElement?.hasAttribute("onclick")
        );
        return Math.min(
            1,
            (scoreElements.length + (hasScoreUpdate ? 1 : 0)) / 3
        );
    }

    private evaluateObstacles(doc: Document): number {
        const obstacleElements = doc.querySelectorAll(
            ".obstacle, .enemy, .hazard, .barrier, [data-obstacle], [data-enemy]"
        );
        return Math.min(1, obstacleElements.length / 3);
    }

    private evaluateGameLoop(doc: Document): number {
        const gameLoopIndicators = [
            doc.querySelector('[style*="animation"]') !== null,
            doc.querySelector('[style*="transition"]') !== null,
            doc.querySelector(".game-player") !== null,
            doc.querySelector(".game-score") !== null,
            doc.querySelector('[onclick*="score"]') !== null,
        ];
        return (
            gameLoopIndicators.filter(Boolean).length /
            gameLoopIndicators.length
        );
    }

    private calculateWeightedTotal(scores: FitnessScores): number {
        const weights = {
            interactivity: 1.5,
            responsiveness: 1.2,
            aesthetics: 1.0,
            performance: 1.0,
            novelty: 0.8,
            userInput: 1.2,
            stateManagement: 1.0,
            feedback: 1.0,
            progression: 1.0,
            gameElements: 1.2,
            socialElements: 0.8,
            mediaElements: 0.8,
            nostalgia: 0.8,
            playerControl: 1.5,
            collectibles: 1.2,
            scoring: 1.3,
            obstacles: 1.1,
            gameLoop: 1.4,
        };

        let total = 0;
        let weightSum = 0;

        for (const [key, weight] of Object.entries(weights)) {
            total += scores[key as keyof FitnessScores] * weight;
            weightSum += weight;
        }

        // Normalize to 0-1 range
        return total / weightSum;
    }
}
