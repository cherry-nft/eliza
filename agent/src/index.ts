import { DirectClientInterface } from "@ai16z/client-direct";
import {
    AgentRuntime,
    Character,
    defaultCharacter,
    elizaLogger,
    ModelProviderName,
    settings,
    validateCharacterConfig,
} from "@ai16z/eliza";
import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { createNodePlugin } from "@ai16z/plugin-node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArguments(): {
    character?: string;
    characters?: string;
} {
    try {
        return yargs(process.argv.slice(3))
            .option("character", {
                type: "string",
                description: "Path to the character JSON file",
            })
            .option("characters", {
                type: "string",
                description:
                    "Comma separated list of paths to character JSON files",
            })
            .parseSync();
    } catch (error) {
        elizaLogger.error("Error parsing arguments:", error);
        return {};
    }
}

function tryLoadFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return null;
    }
}

async function loadCharacters(charactersArg: string): Promise<Character[]> {
    let characterPaths = charactersArg
        ?.split(",")
        .map((filePath) => filePath.trim());
    const loadedCharacters = [];

    if (characterPaths?.length > 0) {
        for (const characterPath of characterPaths) {
            let content = null;
            let resolvedPath = "";

            const pathsToTry = [
                characterPath,
                path.resolve(process.cwd(), characterPath),
                path.resolve(process.cwd(), "agent", characterPath),
                path.resolve(__dirname, characterPath),
                path.resolve(
                    __dirname,
                    "characters",
                    path.basename(characterPath)
                ),
                path.resolve(
                    __dirname,
                    "../characters",
                    path.basename(characterPath)
                ),
                path.resolve(
                    __dirname,
                    "../../characters",
                    path.basename(characterPath)
                ),
            ];

            for (const tryPath of pathsToTry) {
                content = tryLoadFile(tryPath);
                if (content !== null) {
                    resolvedPath = tryPath;
                    break;
                }
            }

            if (content === null) {
                elizaLogger.error(
                    `Error loading character from ${characterPath}: File not found`
                );
                process.exit(1);
            }

            try {
                const character = JSON.parse(content);
                validateCharacterConfig(character);
                loadedCharacters.push(character);
                elizaLogger.info(
                    `Successfully loaded character from: ${resolvedPath}`
                );
            } catch (e) {
                elizaLogger.error(
                    `Error parsing character from ${resolvedPath}: ${e}`
                );
                process.exit(1);
            }
        }
    }

    if (loadedCharacters.length === 0) {
        elizaLogger.info("No characters found, using default character");
        loadedCharacters.push(defaultCharacter);
    }

    return loadedCharacters;
}

function getTokenForProvider(
    provider: ModelProviderName,
    character: Character
) {
    switch (provider) {
        case ModelProviderName.OPENROUTER:
            return (
                character.settings?.secrets?.OPENROUTER ||
                settings.OPENROUTER_API_KEY
            );
        default:
            return null;
    }
}

async function main() {
    const args = parseArguments();
    const characters = await loadCharacters(
        args.characters || args.character || ""
    );

    for (const character of characters) {
        const runtime = new AgentRuntime({
            character,
            plugins: [bootstrapPlugin, createNodePlugin()],
            clients: [new DirectClientInterface()],
        });

        await runtime.start();
    }
}

main().catch((error) => {
    elizaLogger.error("Error in main:", error);
    process.exit(1);
});
