import express from "express";
import twitterRouter from "./twitter";

const router = express.Router();

router.use("/twitter", twitterRouter);

// Add SSE endpoint for status updates
router.get("/:agentId/status", (req, res) => {
    const headers = {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
    };
    res.writeHead(200, headers);

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
    });
});

export default router;
