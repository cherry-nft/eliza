import { MutationOperator, MutationType } from "./types";
import { JSDOM } from "jsdom";

function createDOM(html: string): JSDOM {
    return new JSDOM(`<!DOCTYPE html><div id="root">${html}</div>`);
}

function getRandomElement(dom: JSDOM): HTMLElement | null {
    const elements = Array.from(dom.window.document.querySelectorAll("*"));
    if (elements.length === 0) return null;
    return elements[Math.floor(Math.random() * elements.length)] as HTMLElement;
}

export const addInteractionMutation: MutationOperator = {
    name: MutationType.ADD_INTERACTION,
    weight: 1,
    apply: async (html: string): Promise<string> => {
        const dom = createDOM(html);
        const element = getRandomElement(dom);

        if (!element) return html;

        const interactions = [
            () => {
                element.setAttribute(
                    "onclick",
                    "this.classList.toggle('active')"
                );
                element.classList.add("interactive");
            },
            () => {
                element.setAttribute(
                    "onmouseover",
                    "this.style.transform='scale(1.1)'"
                );
                element.setAttribute(
                    "onmouseout",
                    "this.style.transform='scale(1)'"
                );
                element.classList.add("hoverable");
            },
            () => {
                element.setAttribute("draggable", "true");
                element.setAttribute(
                    "ondragstart",
                    "event.dataTransfer.setData('text', event.target.id)"
                );
                element.classList.add("draggable");
            },
        ];

        const randomInteraction =
            interactions[Math.floor(Math.random() * interactions.length)];
        randomInteraction();

        return dom.window.document.querySelector("#root")?.innerHTML || html;
    },
};

export const modifyStyleMutation: MutationOperator = {
    name: MutationType.MODIFY_STYLE,
    weight: 1,
    apply: async (html: string): Promise<string> => {
        const dom = createDOM(html);
        const element = getRandomElement(dom);

        if (!element) return html;

        const styles = [
            () => {
                element.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 80%)`;
                element.style.borderRadius = "8px";
                element.style.padding = "10px";
            },
            () => {
                element.style.border = "2px solid #333";
                element.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.2)";
                element.style.margin = "10px";
            },
            () => {
                element.style.color = `hsl(${Math.random() * 360}, 70%, 30%)`;
                element.style.fontWeight = "bold";
                element.style.textShadow = "1px 1px 2px rgba(0,0,0,0.1)";
            },
        ];

        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        randomStyle();

        return dom.window.document.querySelector("#root")?.innerHTML || html;
    },
};

export const addAnimationMutation: MutationOperator = {
    name: MutationType.ADD_ANIMATION,
    weight: 1,
    apply: async (html: string): Promise<string> => {
        const dom = createDOM(html);
        const element = getRandomElement(dom);

        if (!element) return html;

        const animations = [
            () => {
                element.style.animation = "bounce 1s infinite";
                element.style.transform = "translateY(0)";
            },
            () => {
                element.style.animation = "pulse 2s infinite";
                element.style.transform = "scale(1)";
            },
            () => {
                element.style.animation = "rotate 3s linear infinite";
                element.style.transformOrigin = "center";
            },
        ];

        const randomAnimation =
            animations[Math.floor(Math.random() * animations.length)];
        randomAnimation();

        // Add keyframes to the document
        const style = dom.window.document.createElement("style");
        style.textContent = `
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        dom.window.document.head.appendChild(style);

        return dom.window.document.querySelector("#root")?.innerHTML || html;
    },
};

export const changeLayoutMutation: MutationOperator = {
    name: MutationType.CHANGE_LAYOUT,
    weight: 1,
    apply: async (html: string): Promise<string> => {
        const dom = createDOM(html);
        const element = getRandomElement(dom);

        if (!element) return html;

        const layouts = [
            () => {
                element.style.display = "flex";
                element.style.flexDirection =
                    Math.random() > 0.5 ? "row" : "column";
                element.style.gap = "10px";
                element.style.justifyContent = "space-between";
            },
            () => {
                element.style.display = "grid";
                element.style.gridTemplateColumns =
                    "repeat(auto-fit, minmax(100px, 1fr))";
                element.style.gap = "15px";
            },
            () => {
                element.style.position = "relative";
                Array.from(element.children).forEach((child: Element) => {
                    (child as HTMLElement).style.position = "absolute";
                    (child as HTMLElement).style.top =
                        `${Math.random() * 100}%`;
                    (child as HTMLElement).style.left =
                        `${Math.random() * 100}%`;
                });
            },
        ];

        const randomLayout =
            layouts[Math.floor(Math.random() * layouts.length)];
        randomLayout();

        return dom.window.document.querySelector("#root")?.innerHTML || html;
    },
};

export const addGameElementMutation: MutationOperator = {
    name: MutationType.ADD_GAME_ELEMENT,
    weight: 1,
    apply: async (html: string): Promise<string> => {
        const dom = createDOM(html);
        const element = getRandomElement(dom);
        const document = dom.window.document;

        if (!element) return html;

        const gameElements = [
            () => {
                const score = document.createElement("div");
                score.className = "game-score";
                score.textContent = "Score: 0";
                score.style.position = "absolute";
                score.style.top = "10px";
                score.style.right = "10px";
                score.style.padding = "5px 10px";
                score.style.backgroundColor = "#333";
                score.style.color = "#fff";
                score.style.borderRadius = "5px";
                element.appendChild(score);
            },
            () => {
                const player = document.createElement("div");
                player.className = "game-player";
                player.style.width = "32px";
                player.style.height = "32px";
                player.style.backgroundColor = "#f00";
                player.style.position = "absolute";
                player.style.bottom = "20px";
                player.style.left = "50%";
                player.style.transform = "translateX(-50%)";
                element.appendChild(player);
            },
            () => {
                const collectible = document.createElement("div");
                collectible.className = "game-collectible";
                collectible.style.width = "16px";
                collectible.style.height = "16px";
                collectible.style.backgroundColor = "#ff0";
                collectible.style.position = "absolute";
                collectible.style.borderRadius = "50%";
                collectible.style.animation = "float 2s infinite ease-in-out";
                element.appendChild(collectible);
            },
        ];

        const randomGameElement =
            gameElements[Math.floor(Math.random() * gameElements.length)];
        randomGameElement();

        return dom.window.document.querySelector("#root")?.innerHTML || html;
    },
};

export const mutationOperators: MutationOperator[] = [
    addInteractionMutation,
    modifyStyleMutation,
    addAnimationMutation,
    changeLayoutMutation,
    addGameElementMutation,
];
