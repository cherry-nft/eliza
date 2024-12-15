import express, { Request as ExpressRequest } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import { elizaLogger, generateCaption, generateImage } from "@ai16z/eliza";
import { composeContext } from "@ai16z/eliza";
import { generateMessageResponse } from "@ai16z/eliza";
import { messageCompletionFooter } from "@ai16z/eliza";
import { AgentRuntime } from "@ai16z/eliza";
import {
    Content,
    Memory,
    ModelClass,
    Client,
    IAgentRuntime,
    ServiceType,
    IBrowserService,
} from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { createApiRouter } from "./api.ts";
import * as fs from "fs";
import * as path from "path";

// Initialize multer
const upload = multer({ storage: multer.memoryStorage() });

// Define custom request type with multer file
interface CustomRequest extends ExpressRequest {
    file?: Express.Multer.File;
}

export const messageHandlerTemplate =
    // {{goals}}
    `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write the next message for {{agentName}}.
` + messageCompletionFooter;

export interface SimliClientConfig {
    apiKey: string;
    faceID: string;
    handleSilence: boolean;
    videoRef: any;
    audioRef: any;
}
export const DirectClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        elizaLogger.log("DirectClientInterface start");
        const client = new DirectClient();
        await client.start(runtime);
        return client;
    },
    stop: async (runtime: IAgentRuntime, client?: any) => {
        if (client instanceof DirectClient) {
            await client.stop(runtime);
        }
    },
};

export class DirectClient implements Client {
    public app: express.Application;
    private agents: Map<string, AgentRuntime>;
    private server: any;
    private currentRuntime: IAgentRuntime | null = null;
    private statusConnections: Map<string, express.Response[]>;

    constructor() {
        elizaLogger.log("DirectClient constructor");
        this.app = express();
        this.app.use(cors());
        this.agents = new Map();
        this.currentRuntime = null;
        this.statusConnections = new Map();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        const apiRouter = createApiRouter(this.agents);
        this.app.use(apiRouter);

        // Update the route handler to use CustomRequest
        this.app.post(
            "/:agentId/whisper",
            upload.single("file"),
            async (req: CustomRequest, res: express.Response) => {
                const audioFile = req.file;
                const agentId = req.params.agentId;

                if (!audioFile) {
                    res.status(400).send("No audio file provided");
                    return;
                }

                let runtime = this.agents.get(agentId);

                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                const formData = new FormData();
                const audioBlob = new Blob([audioFile.buffer], {
                    type: audioFile.mimetype,
                });
                formData.append("file", audioBlob, audioFile.originalname);
                formData.append("model", "whisper-1");

                const response = await fetch(
                    "https://api.openai.com/v1/audio/transcriptions",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${runtime.token}`,
                        },
                        body: formData,
                    }
                );

                const data = await response.json();
                res.json(data);
            }
        );

        this.app.post(
            "/:agentId/message",
            async (req: express.Request, res: express.Response) => {
                const agentId = req.params.agentId;
                const roomId = stringToUuid(
                    req.body.roomId ?? "default-room-" + agentId
                );
                const userId = stringToUuid(req.body.userId ?? "user");

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const text = req.body.text;
                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const state = await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                });

                const context = composeContext({
                    state,
                    template: messageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                // save response to memory
                const responseMessage = {
                    ...userMessage,
                    userId: runtime.agentId,
                    content: response,
                };

                await runtime.messageManager.createMemory(responseMessage);

                if (!response) {
                    res.status(500).send(
                        "No response from generateMessageResponse"
                    );
                    return;
                }

                let message = null as Content | null;

                await runtime.evaluate(memory, state);

                const _result = await runtime.processActions(
                    memory,
                    [responseMessage],
                    state,
                    async (newMessages) => {
                        message = newMessages;
                        return [memory];
                    }
                );

                if (message) {
                    res.json([response, message]);
                } else {
                    res.json([response]);
                }
            }
        );

        this.app.post(
            "/:agentId/image",
            async (req: express.Request, res: express.Response) => {
                const agentId = req.params.agentId;
                const agent = this.agents.get(agentId);
                if (!agent) {
                    res.status(404).send("Agent not found");
                    return;
                }

                const images = await generateImage({ ...req.body }, agent);
                const imagesRes: { image: string; caption: string }[] = [];
                if (images.data && images.data.length > 0) {
                    for (let i = 0; i < images.data.length; i++) {
                        const caption = await generateCaption(
                            { imageUrl: images.data[i] },
                            agent
                        );
                        imagesRes.push({
                            image: images.data[i],
                            caption: caption.title,
                        });
                    }
                }
                res.json({ images: imagesRes });
            }
        );

        this.app.post(
            "/fine-tune",
            async (req: express.Request, res: express.Response) => {
                try {
                    const response = await fetch(
                        "https://api.bageldb.ai/api/v1/asset",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-API-KEY": `${process.env.BAGEL_API_KEY}`,
                            },
                            body: JSON.stringify(req.body),
                        }
                    );

                    const data = await response.json();
                    res.json(data);
                } catch (error) {
                    res.status(500).json({
                        error: "Please create an account at bakery.bagel.net and get an API key. Then set the BAGEL_API_KEY environment variable.",
                        details: error.message,
                    });
                }
            }
        );
        this.app.get(
            "/fine-tune/:assetId",
            async (req: express.Request, res: express.Response) => {
                const assetId = req.params.assetId;
                const downloadDir = path.join(
                    process.cwd(),
                    "downloads",
                    assetId
                );

                console.log("Download directory:", downloadDir);

                try {
                    console.log("Creating directory...");
                    await fs.promises.mkdir(downloadDir, { recursive: true });

                    console.log("Fetching file...");
                    const fileResponse = await fetch(
                        `https://api.bageldb.ai/api/v1/asset/${assetId}/download`,
                        {
                            headers: {
                                "X-API-KEY": `${process.env.BAGEL_API_KEY}`,
                            },
                        }
                    );

                    if (!fileResponse.ok) {
                        throw new Error(
                            `API responded with status ${fileResponse.status}: ${await fileResponse.text()}`
                        );
                    }

                    console.log("Response headers:", fileResponse.headers);

                    const fileName =
                        fileResponse.headers
                            .get("content-disposition")
                            ?.split("filename=")[1]
                            ?.replace(/"/g, "") || "default_name.txt";

                    console.log("Saving as:", fileName);

                    const arrayBuffer = await fileResponse.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    const filePath = path.join(downloadDir, fileName);
                    console.log("Full file path:", filePath);

                    await fs.promises.writeFile(filePath, buffer);

                    // Verify file was written
                    const stats = await fs.promises.stat(filePath);
                    console.log(
                        "File written successfully. Size:",
                        stats.size,
                        "bytes"
                    );

                    res.json({
                        success: true,
                        message: "Single file downloaded successfully",
                        downloadPath: downloadDir,
                        fileCount: 1,
                        fileName: fileName,
                        fileSize: stats.size,
                    });
                } catch (error) {
                    console.error("Detailed error:", error);
                    res.status(500).json({
                        error: "Failed to download files from BagelDB",
                        details: error.message,
                        stack: error.stack,
                    });
                }
            }
        );

        // Add status endpoint
        this.app.get("/api/:agentId/status", (req, res) => {
            const agentId = req.params.agentId;
            const headers = {
                "Content-Type": "text/event-stream",
                Connection: "keep-alive",
                "Cache-Control": "no-cache",
            };
            res.writeHead(200, headers);

            // Add this connection to our map
            if (!this.statusConnections.has(agentId)) {
                this.statusConnections.set(agentId, []);
            }
            this.statusConnections.get(agentId)?.push(res);

            // Send initial status
            const data = `data: ${JSON.stringify({ text: "Connected..." })}\n\n`;
            res.write(data);

            // Keep connection alive
            const keepAlive = setInterval(() => {
                res.write(": keepalive\n\n");
            }, 20000);

            // Clean up on close
            req.on("close", () => {
                clearInterval(keepAlive);
                const connections = this.statusConnections.get(agentId) || [];
                this.statusConnections.set(
                    agentId,
                    connections.filter((conn) => conn !== res)
                );
            });
        });
    }

    private emitStatus(agentId: string, status: string) {
        const connections = this.statusConnections.get(agentId) || [];
        const data = `data: ${JSON.stringify({ text: status })}\n\n`;
        connections.forEach((res) => {
            try {
                res.write(data);
            } catch (error) {
                elizaLogger.error("Error sending status update:", error);
            }
        });
    }

    async registerRuntime(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.info(
            `Registering runtime for agent: ${runtime.character.name}`
        );
        if (runtime instanceof AgentRuntime) {
            this.agents.set(runtime.agentId, runtime);
            this.agents.set(runtime.character.name.toLowerCase(), runtime);
            this.currentRuntime = runtime;

            // Set up status emitter for browser service
            const browserService = runtime.getService<IBrowserService>(
                ServiceType.BROWSER
            );
            if (browserService?.setStatusEmitter) {
                browserService.setStatusEmitter((status: string) => {
                    this.emitStatus(runtime.agentId, status);
                });
            }
        } else {
            throw new Error("Runtime must be an instance of AgentRuntime");
        }
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        await this.registerRuntime(runtime);
        await this.start(runtime);
    }

    async start(runtime: IAgentRuntime): Promise<void> {
        this.currentRuntime = runtime;
        const port = parseInt(process.env.PORT || "3000");
        this.server = this.app.listen(port, () => {
            elizaLogger.success(`Server running at http://localhost:${port}/`);
        });

        // Handle graceful shutdown
        const gracefulShutdown = async () => {
            elizaLogger.log("Received shutdown signal, closing server...");
            if (this.currentRuntime) {
                await this.stop(this.currentRuntime);
            }
            process.exit(0);
        };

        process.on("SIGTERM", gracefulShutdown);
        process.on("SIGINT", gracefulShutdown);
    }

    async stop(_runtime: IAgentRuntime): Promise<void> {
        if (this.server) {
            await new Promise<void>((resolve, reject) => {
                this.server.close((err?: Error) => {
                    if (err) {
                        elizaLogger.error("Error stopping server:", err);
                        reject(err);
                    } else {
                        elizaLogger.success("Server stopped");
                        resolve();
                    }
                });
            });
        }
        this.currentRuntime = null;
    }
}

export default DirectClientInterface;
