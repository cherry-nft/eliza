import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { claudeService } from "../services/ClaudeService";
import patternRouter from "./patternServer";
import { SERVER_CONFIG } from "./config/serverConfig";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("[Server] Configuration loaded successfully");

const app = express();
const port = SERVER_CONFIG.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Make Claude service available to routes
app.locals.claudeService = claudeService;

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
