import { DirectClient } from "@ai16z/client-direct";
import { SqliteDatabaseAdapter } from "@ai16z/adapter-sqlite";
import Database from "better-sqlite3";
import {
    AgentRuntime,
    Character,
    defaultCharacter,
    elizaLogger,
    ModelProviderName,
    settings,
    validateCharacterConfig,
    CacheManager,
    MemoryCacheAdapter,
} from "@ai16z/eliza";
import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { createNodePlugin } from "@ai16z/plugin-node";
import { webPlugin } from "@ai16z/plugin-web";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import routes from "./routes";

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
    try {
        const args = parseArguments();
        elizaLogger.info("Parsed arguments:", args);

        const characters = await loadCharacters(
            args.characters || args.character || ""
        );
        elizaLogger.info("Loaded characters:", characters);

        // Create SQLite database
        const dbPath = path.join(process.cwd(), "eliza.db");
        const db = new Database(dbPath);
        const dbAdapter = new SqliteDatabaseAdapter(db);
        await dbAdapter.init();

        // Create cache manager
        const cacheAdapter = new MemoryCacheAdapter();
        const cacheManager = new CacheManager(cacheAdapter);

        // Create DirectClient
        const client = new DirectClient();

        // Add routes
        client.app.use("/api", routes);

        // Start the server first
        const port = process.env.PORT || 3000;
        client.app.listen(port, () => {
            elizaLogger.info(`Server is running on port ${port}`);
        });

        for (const character of characters) {
            elizaLogger.info("Creating runtime for character:", character.name);

            const token = getTokenForProvider(
                character.modelProvider as ModelProviderName,
                character
            );
            elizaLogger.info("Got token for provider:", {
                provider: character.modelProvider,
                hasToken: !!token,
            });

            const runtime = new AgentRuntime({
                character,
                plugins: [bootstrapPlugin, createNodePlugin(), webPlugin],
                databaseAdapter: dbAdapter,
                cacheManager,
                token: token || "",
                modelProvider:
                    (character.modelProvider as ModelProviderName) ||
                    ModelProviderName.OPENROUTER,
            });

            elizaLogger.info("Initializing runtime...");
            await runtime.initialize();
            elizaLogger.info("Runtime initialized successfully");

            // Register runtime with DirectClient
            await client.registerRuntime(runtime);
        }
    } catch (error) {
        elizaLogger.error("Error in main:", error);
        if (error instanceof Error) {
            elizaLogger.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        process.exit(1);
    }
}

main().catch((error) => {
    elizaLogger.error("Uncaught error in main:", error);
    if (error instanceof Error) {
        elizaLogger.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
    }
    process.exit(1);
});
