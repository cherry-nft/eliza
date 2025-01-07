import { type PatternData } from "./test-insert-example";

export const loadingSpinnerPatterns = [
    {
        type: "animation",
        pattern_name: "Jumping Blocks Loading Animation",
        user_id: "loading-spinner-animation-1",
        agent_id:
            "/Users/sherchaudhary/eliza/packages/plugin-artcade/embeddings/templates/loading-spinner-animation-1.html",
        content: {
            html: `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Jump Flip Animation</title>
    </head>
    <body>
        <main>
            <div style="--i: 0; --color: #be185d"></div>
            <div style="--i: 1; --color: #4f46e5"></div>
            <div style="--i: 2; --color: #047857"></div>
        </main>
    </body>
</html>`,
            css: `* {
                box-sizing: border-box;
            }
            html,
            body {
                height: 100%;
            }
            body {
                display: grid;
                place-items: center;
                margin: 0;
                background-color: #09090b;
            }
            main {
                display: flex;
                gap: 5vmin;
            }
            div {
                --delay: 0.1s;
                --duration: 2s;
                --int: 1;
                --rotate: 0.5turn;
                display: grid;
                grid-template-areas: "stack";
                place-items: center;
                inline-size: 10vmin;
                aspect-ratio: 1;
                border-radius: 1vmin;
                background-color: var(--color);
                animation: jump-flip var(--duration)
                    calc(var(--i) * var(--delay)) infinite;
            }
            div::after {
                --int: -1;
                --rotate: -0.5turn;
                content: "";
                grid-area: stack;
                background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI2ZmZmZmZiIgdmlld0JveD0iMCAwIDI1NiAyNTYiPjxwYXRoIGQ9Ik0yMTguMjksMTgyLjE3YTEyLDEyLDAsMCwxLTE2LjQ3LDQuMTJMMTQwLDE0OS4xOVYyMTZhMTIsMTIsMCwwLDEtMjQsMFYxNDkuMTlsLTYxLjgyLDM3LjFhMTIsMTIsMCwxLDEtMTIuMzUtMjAuNThMMTA0LjY4LDEyOCw0MS44Myw5MC4yOUExMiwxMiwwLDEsMSw1NC4xOCw2OS43MUwxMTYsMTA2LjgxVjQwYTEyLDEyLDAsMCwxLDI0LDB2NjYuODFsNjEuODItMzcuMWExMiwxMiwwLDEsMSwxMi4zNSwyMC41OEwxNTEuMzIsMTI4bDYyLjg1LDM3LjcxQTEyLDEyLDAsMCwxLDIxOC4yOSwxODIuMTdaIj48L3BhdGg+PC9zdmc+");
                background-size: 100%;
                inline-size: 50%;
                block-size: 50%;
                animation: jump-flip var(--duration)
                    calc(var(--i) * var(--delay) + 0.63s) infinite;
            }
            @keyframes jump-flip {
                10% {
                    rotate: 0.01turn;
                    scale: 1.2 0.5;
                    translate: 0 calc(35% * var(--int));
                }
                15% {
                    rotate: 0turn;
                    scale: 0.75 2.5;
                }
                20%,
                35% {
                    scale: 1;
                    translate: 0 calc(-250% * var(--int));
                }
                40% {
                    scale: 0.8 2;
                }
                42%,
                100% {
                    rotate: var(--rotate);
                }
                45% {
                    scale: 1.2 0.8;
                    translate: 0 calc(20% * var(--int));
                    /* prettier-ignore */
                    animation-timing-function: linear(
          0, 0.218 2.1%, 0.862 6.5%, 1.114, 1.296 10.7%, 1.346, 1.37 12.9%, 1.373,
          1.364 14.5%, 1.315 16.2%, 1.032 21.8%, 0.941 24%, 0.891 25.9%, 0.877,
          0.869 27.8%, 0.87, 0.882 30.7%, 0.907 32.4%, 0.981 36.4%, 1.012 38.3%, 1.036,
          1.046 42.7% 44.1%, 1.042 45.7%, 0.996 53.3%, 0.988, 0.984 57.5%, 0.985 60.7%,
          1.001 68.1%, 1.006 72.2%, 0.998 86.7%, 1
        );
                }
                80%,
                100% {
                    scale: 1;
                    translate: 0 0;
                }
            }`,
            context:
                "A modern, playful loading animation with three blocks that jump and flip in sequence",
            metadata: {
                type: "animation",
                theme: "dark",
                animationType: "loading",
                interactions: ["auto_play", "infinite_loop"],
                colors: {
                    background: "#09090b",
                    block1: "#be185d",
                    block2: "#4f46e5",
                    block3: "#047857",
                },
                components: [
                    "jumping_blocks",
                    "flip_animation",
                    "sequence_timing",
                    "svg_icons",
                ],
                animation: {
                    duration: "2s",
                    delay: "0.1s",
                    timing: "custom_easing",
                    properties: ["rotate", "scale", "translate"],
                },
            },
        },
        room_id: [
            "loading-spinner-animation-feedback",
            "jump-flip-animation-keyframes",
            "auto-play-infinite-loop",
            "modern-playful-blocks",
        ].join("-"),
    },
];

export type { PatternData };
