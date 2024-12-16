import { CrossoverOperator } from "./types";
import { JSDOM } from "jsdom";

function createDOM(html: string): JSDOM {
    return new JSDOM(`<!DOCTYPE html><div id="root">${html}</div>`);
}

function getAllElements(dom: JSDOM): HTMLElement[] {
    return Array.from(
        dom.window.document.querySelectorAll("*")
    ) as HTMLElement[];
}

export const singlePointCrossover: CrossoverOperator = {
    name: "single_point",
    weight: 1,
    apply: async (
        parent1: string,
        parent2: string
    ): Promise<[string, string]> => {
        const dom1 = createDOM(parent1);
        const dom2 = createDOM(parent2);

        const elements1 = getAllElements(dom1);
        const elements2 = getAllElements(dom2);

        if (elements1.length === 0 || elements2.length === 0) {
            return [parent1, parent2];
        }

        // Choose random crossover points
        const point1 = Math.floor(Math.random() * elements1.length);
        const point2 = Math.floor(Math.random() * elements2.length);

        // Swap elements after crossover points
        const temp = elements1[point1].innerHTML;
        elements1[point1].innerHTML = elements2[point2].innerHTML;
        elements2[point2].innerHTML = temp;

        return [
            dom1.window.document.querySelector("#root")?.innerHTML || parent1,
            dom2.window.document.querySelector("#root")?.innerHTML || parent2,
        ];
    },
};

export const attributeCrossover: CrossoverOperator = {
    name: "attribute",
    weight: 1,
    apply: async (
        parent1: string,
        parent2: string
    ): Promise<[string, string]> => {
        const dom1 = createDOM(parent1);
        const dom2 = createDOM(parent2);

        const elements1 = getAllElements(dom1);
        const elements2 = getAllElements(dom2);

        if (elements1.length === 0 || elements2.length === 0) {
            return [parent1, parent2];
        }

        // Choose random elements to swap attributes
        const element1 =
            elements1[Math.floor(Math.random() * elements1.length)];
        const element2 =
            elements2[Math.floor(Math.random() * elements2.length)];

        // Swap style attributes
        const style1 = element1.getAttribute("style");
        const style2 = element2.getAttribute("style");

        if (style1) element2.setAttribute("style", style1);
        if (style2) element1.setAttribute("style", style2);

        // Swap class attributes
        const class1 = element1.getAttribute("class");
        const class2 = element2.getAttribute("class");

        if (class1) element2.setAttribute("class", class1);
        if (class2) element1.setAttribute("class", class2);

        return [
            dom1.window.document.querySelector("#root")?.innerHTML || parent1,
            dom2.window.document.querySelector("#root")?.innerHTML || parent2,
        ];
    },
};

export const subtreeCrossover: CrossoverOperator = {
    name: "subtree",
    weight: 1,
    apply: async (
        parent1: string,
        parent2: string
    ): Promise<[string, string]> => {
        const dom1 = createDOM(parent1);
        const dom2 = createDOM(parent2);

        const elements1 = getAllElements(dom1);
        const elements2 = getAllElements(dom2);

        if (elements1.length === 0 || elements2.length === 0) {
            return [parent1, parent2];
        }

        // Choose random elements with children
        const element1 =
            elements1[Math.floor(Math.random() * elements1.length)];
        const element2 =
            elements2[Math.floor(Math.random() * elements2.length)];

        // Swap entire subtrees
        const temp = element1.innerHTML;
        element1.innerHTML = element2.innerHTML;
        element2.innerHTML = temp;

        return [
            dom1.window.document.querySelector("#root")?.innerHTML || parent1,
            dom2.window.document.querySelector("#root")?.innerHTML || parent2,
        ];
    },
};

export const interactionCrossover: CrossoverOperator = {
    name: "interaction",
    weight: 1,
    apply: async (
        parent1: string,
        parent2: string
    ): Promise<[string, string]> => {
        const dom1 = createDOM(parent1);
        const dom2 = createDOM(parent2);

        const elements1 = getAllElements(dom1);
        const elements2 = getAllElements(dom2);

        if (elements1.length === 0 || elements2.length === 0) {
            return [parent1, parent2];
        }

        // Choose random elements
        const element1 =
            elements1[Math.floor(Math.random() * elements1.length)];
        const element2 =
            elements2[Math.floor(Math.random() * elements2.length)];

        // List of interactive attributes to swap
        const interactiveAttributes = [
            "onclick",
            "onmouseover",
            "onmouseout",
            "ondragstart",
            "ondragend",
            "draggable",
        ];

        // Swap interactive attributes
        interactiveAttributes.forEach((attr) => {
            const attr1 = element1.getAttribute(attr);
            const attr2 = element2.getAttribute(attr);

            if (attr1) element2.setAttribute(attr, attr1);
            if (attr2) element1.setAttribute(attr, attr2);
        });

        return [
            dom1.window.document.querySelector("#root")?.innerHTML || parent1,
            dom2.window.document.querySelector("#root")?.innerHTML || parent2,
        ];
    },
};

export const crossoverOperators: CrossoverOperator[] = [
    singlePointCrossover,
    attributeCrossover,
    subtreeCrossover,
    interactionCrossover,
];
