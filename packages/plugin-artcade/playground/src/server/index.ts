import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { VectorDatabase } from "@artcade/plugin/services/VectorDatabase";
import { ClaudeService } from "./services/ClaudeService";
import patternRouter from "./patternServer";
import { SERVER_CONFIG } from "./config/serverConfig";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("[Server] Configuration loaded successfully");

// Initialize VectorDatabase
const vectorDb = new VectorDatabase();
await vectorDb.initialize(runtime); // We'll need to set up runtime properly

// Initialize ClaudeService with VectorDatabase
const claudeService = new ClaudeService(vectorDb);

const app = express();
const port = SERVER_CONFIG.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Make services available to routes
app.locals.claudeService = claudeService;
app.locals.vectorDb = vectorDb;

// Routes
app.use("/api/patterns", patternRouter);

// Error handling
app.use(
    (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.error("[Server] Error:", err.stack);
        res.status(500).json({ error: err.message });
    }
);

app.listen(port, () => {
    console.log(`[Server] Pattern server running on port ${port}`);
});
