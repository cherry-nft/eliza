import { clientPatternService } from "./ClientPatternService";
import {
    PatternGenerationError,
    GeneratedPattern,
} from "../shared/pattern.types";

interface TestCase {
    category: string;
    name: string;
    prompt: string;
    expectedFeatures: string[];
}

const TEST_CASES: TestCase[] = [
    // Category 1: Simple Interactive Elements
    {
        category: "Interactive Elements",
        name: "Pulsing Button",
        prompt: "Create a button that smoothly pulses with a subtle glow effect when hovered, and changes color when clicked. The button should have rounded corners and a modern design.",
        expectedFeatures: [
            "hover animation",
            "click handling",
            "color transition",
            "CSS effects",
        ],
    },
    {
        category: "Interactive Elements",
        name: "Progress Bar",
        prompt: "Create an animated progress bar that fills up over 5 seconds, then resets and starts again. Add a percentage counter above it. Use a gradient color scheme.",
        expectedFeatures: [
            "animation timing",
            "state management",
            "gradient colors",
            "text updates",
        ],
    },

    // Category 2: Simple Games
    {
        category: "Games",
        name: "Memory Cards",
        prompt: "Create a simple memory card game with 6 pairs of cards. Cards should flip when clicked, and match pairs should stay revealed. Include a move counter.",
        expectedFeatures: [
            "game state",
            "card matching",
            "flip animation",
            "score tracking",
        ],
    },
    {
        category: "Games",
        name: "Target Practice",
        prompt: "Make a simple target practice game where circles appear randomly on screen and disappear after 2 seconds. Click them to score points. Add a timer and high score.",
        expectedFeatures: [
            "randomization",
            "timing",
            "click detection",
            "scoring",
        ],
    },

    // Category 3: Visual Effects
    {
        category: "Visual Effects",
        name: "Particle Trail",
        prompt: "Create a particle effect that follows the mouse cursor, leaving a trail of fading particles. Particles should have random sizes and colors from a preset palette.",
        expectedFeatures: [
            "mouse tracking",
            "particle system",
            "color management",
            "animation",
        ],
    },
    {
        category: "Visual Effects",
        name: "Loading Animation",
        prompt: "Design a creative loading animation using only CSS. It should be a continuous animation that could loop indefinitely. Use a modern, minimal style.",
        expectedFeatures: [
            "CSS animation",
            "keyframes",
            "transforms",
            "timing functions",
        ],
    },
];

async function testPatternVariations() {
    console.log("[PatternTest] Starting pattern variation tests...");
    const results: Record<string, any> = {};

    for (const testCase of TEST_CASES) {
        console.log(
            `\n[PatternTest] Testing ${testCase.category}: ${testCase.name}`
        );
        console.log("[PatternTest] Prompt:", testCase.prompt);

        try {
            // Generate the pattern
            const startTime = Date.now();
            const pattern = await clientPatternService.generatePattern(
                testCase.prompt
            );
            const duration = Date.now() - startTime;

            // Log generation results
            console.log("\n[PatternTest] Generation Results:");
            console.log("----------------------------------------");
            console.log("Title:", pattern.title);
            console.log("Description:", pattern.description);
            console.log("Generation Time:", duration, "ms");
            console.log("HTML Size:", pattern.html.length, "characters");

            // Log plan details
            console.log("\n[PatternTest] Plan Details:");
            console.log("----------------------------------------");
            console.log("Core Mechanics:", pattern.plan.coreMechanics);
            console.log("Visual Elements:", pattern.plan.visualElements);
            console.log("Interactivity:", pattern.plan.interactivity);
            console.log("Interaction Flow:", pattern.plan.interactionFlow);
            console.log("State Management:", pattern.plan.stateManagement);
            console.log("Asset Requirements:", pattern.plan.assetRequirements);

            // Simple feature check in all text content
            const allContent = JSON.stringify({
                title: pattern.title,
                description: pattern.description,
                plan: pattern.plan,
                html: pattern.html,
            }).toLowerCase();

            const missingFeatures = testCase.expectedFeatures.filter(
                (feature) => !allContent.includes(feature.toLowerCase())
            );

            // Log feature validation
            console.log("\n[PatternTest] Feature Validation:");
            console.log("----------------------------------------");
            console.log("Expected Features:", testCase.expectedFeatures);
            if (missingFeatures.length > 0) {
                console.log("Missing Features:", missingFeatures);
            } else {
                console.log("All expected features found!");
            }

            // Store results
            results[testCase.name] = {
                success: true,
                duration,
                htmlSize: pattern.html.length,
                missingFeatures,
                pattern,
            };
        } catch (error) {
            console.error(
                `\n[PatternTest] Error testing ${testCase.name}:`,
                error
            );
            results[testCase.name] = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }

        // Add a delay between tests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Final summary
    console.log("\n[PatternTest] Test Suite Summary:");
    console.log("----------------------------------------");
    Object.entries(results).forEach(([name, result]) => {
        console.log(`${name}: ${result.success ? "✓" : "✗"}`);
        if (!result.success) {
            console.log(`  Error: ${result.error}`);
        } else {
            console.log(`  Generation Time: ${result.duration}ms`);
            console.log(`  HTML Size: ${result.htmlSize} characters`);
            console.log(`  Missing Features: ${result.missingFeatures.length}`);
        }
    });
}

// Run the test suite
console.log("[PatternTest] Starting test suite...");
testPatternVariations().catch((error) => {
    console.error("[PatternTest] Unhandled error in test suite:", error);
    process.exit(1);
});
