import {
    IAgentRuntime,
    Plugin,
    Service,
    ServiceType,
    IBrowserService,
    Action,
    Memory,
    State,
    HandlerCallback,
    Content,
} from "@ai16z/eliza";
import puppeteer from "puppeteer";

class WebBrowserService extends Service implements IBrowserService {
    private browser: any = null;
    private statusEmitter: ((status: string) => void) | null = null;
    private isInitialized: boolean = false;

    static get serviceType(): ServiceType {
        console.log("[WebBrowserService] Getting service type");
        return ServiceType.BROWSER;
    }

    setStatusEmitter(emitter: (status: string) => void) {
        console.log("[WebBrowserService] Setting status emitter");
        this.statusEmitter = emitter;
    }

    private emitStatus(status: string) {
        console.log(`[WebBrowserService] Emitting status: ${status}`);
        if (this.statusEmitter) {
            console.log(
                "[WebBrowserService] Status emitter exists, calling it"
            );
            this.statusEmitter(status);
        } else {
            console.log("[WebBrowserService] No status emitter set");
        }
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        console.log("[WebBrowserService] Initialize called");
        console.log(
            `[WebBrowserService] Current initialization state: ${this.isInitialized}`
        );

        if (this.isInitialized) {
            console.log(
                "[WebBrowserService] Already initialized, returning early"
            );
            return;
        }

        try {
            console.log("[WebBrowserService] Starting browser initialization");
            this.emitStatus("Initializing browser...");

            console.log("[WebBrowserService] Launching puppeteer");
            this.browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            console.log("[WebBrowserService] Puppeteer launched successfully");

            this.isInitialized = true;
            this.emitStatus("Browser initialized");
            console.log("[WebBrowserService] Initialization complete");
        } catch (error) {
            console.error("[WebBrowserService] Initialization error:", error);
            this.emitStatus(
                `Failed to initialize browser: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            throw error;
        }
    }

    async closeBrowser(): Promise<void> {
        console.log("[WebBrowserService] closeBrowser called");
        if (this.browser) {
            console.log(
                "[WebBrowserService] Browser instance exists, proceeding with closure"
            );
            this.emitStatus("Closing browser...");
            await this.browser.close();
            console.log("[WebBrowserService] Browser closed successfully");
            this.browser = null;
            this.isInitialized = false;
            this.emitStatus("Browser closed");
        } else {
            console.log("[WebBrowserService] No browser instance to close");
        }
    }

    async getPageContent(
        url: string,
        runtime: IAgentRuntime
    ): Promise<{ title: string; description: string; bodyContent: string }> {
        console.log(
            `[WebBrowserService] getPageContent called for URL: ${url}`
        );

        if (!this.isInitialized || !this.browser) {
            console.log(
                "[WebBrowserService] Browser not initialized, initializing now"
            );
            await this.initialize(runtime);
        }

        console.log("[WebBrowserService] Creating new page");
        const page = await this.browser.newPage();
        try {
            console.log("[WebBrowserService] Setting user agent");
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );

            console.log(`[WebBrowserService] Navigating to ${url}`);
            this.emitStatus(`Fetching content from ${url}...`);
            await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
            console.log("[WebBrowserService] Page loaded successfully");

            this.emitStatus("Processing page content...");
            console.log("[WebBrowserService] Starting content extraction");

            const content = await page.evaluate(() => {
                console.log(
                    "[WebBrowserService:Page] Starting page content evaluation"
                );

                console.log("[WebBrowserService:Page] Getting page title");
                const title = document.title;

                console.log(
                    "[WebBrowserService:Page] Getting meta description"
                );
                const description =
                    document
                        .querySelector('meta[name="description"]')
                        ?.getAttribute("content") || "";

                console.log(
                    "[WebBrowserService:Page] Cloning body for content extraction"
                );
                const bodyClone = document.body.cloneNode(true) as HTMLElement;

                console.log(
                    "[WebBrowserService:Page] Getting elements to remove"
                );
                const scripts = bodyClone.getElementsByTagName("script");
                const styles = bodyClone.getElementsByTagName("style");
                const iframes = bodyClone.getElementsByTagName("iframe");
                const noscripts = bodyClone.getElementsByTagName("noscript");

                console.log(
                    "[WebBrowserService:Page] Removing unnecessary elements"
                );
                while (scripts.length > 0) scripts[0].remove();
                while (styles.length > 0) styles[0].remove();
                while (iframes.length > 0) iframes[0].remove();
                while (noscripts.length > 0) noscripts[0].remove();

                console.log("[WebBrowserService:Page] Getting text content");
                const bodyContent = bodyClone.textContent || "";

                console.log(
                    "[WebBrowserService:Page] Cleaning and formatting content"
                );
                const cleanContent = bodyContent.replace(/\s+/g, " ").trim();

                console.log(
                    "[WebBrowserService:Page] Content extraction complete"
                );
                return {
                    title,
                    description,
                    bodyContent: cleanContent,
                };
            });

            console.log("[WebBrowserService] Content retrieved successfully");
            console.log(
                "[WebBrowserService] Content length:",
                content.bodyContent.length
            );
            console.log(
                "[WebBrowserService] Title length:",
                content.title.length
            );
            console.log(
                "[WebBrowserService] Description length:",
                content.description.length
            );

            this.emitStatus("Content retrieved successfully");
            return content;
        } catch (error) {
            console.error(
                "[WebBrowserService] Error in getPageContent:",
                error
            );
            this.emitStatus(
                `Error fetching content: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            throw error;
        } finally {
            console.log("[WebBrowserService] Closing page");
            await page.close();
            console.log("[WebBrowserService] Page closed");
        }
    }

    async isWebsiteAccessible(url: string): Promise<boolean> {
        console.log(
            `[WebBrowserService] isWebsiteAccessible called for URL: ${url}`
        );

        if (!this.isInitialized || !this.browser) {
            console.log(
                "[WebBrowserService] Browser not initialized, attempting initialization"
            );
            try {
                await this.initialize({} as IAgentRuntime);
                console.log("[WebBrowserService] Initialization successful");
            } catch (error) {
                console.error(
                    "[WebBrowserService] Initialization failed:",
                    error
                );
                return false;
            }
        }

        console.log(
            "[WebBrowserService] Creating new page for accessibility check"
        );
        const page = await this.browser.newPage();
        try {
            console.log(`[WebBrowserService] Attempting to access ${url}`);
            await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
            console.log("[WebBrowserService] Website is accessible");
            return true;
        } catch (error) {
            console.error(
                "[WebBrowserService] Website is not accessible:",
                error
            );
            return false;
        } finally {
            console.log("[WebBrowserService] Closing accessibility check page");
            await page.close();
            console.log("[WebBrowserService] Page closed");
        }
    }
}

const BROWSE: Action = {
    name: "BROWSE",
    description: "Browse the web for current information",
    similes: [
        "search",
        "look up",
        "find",
        "check",
        "read",
        "browse",
        "get current news",
        "get latest news",
        "see what's happening",
    ],
    validate: async () => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!callback) {
            console.error("[WebBrowserService] No callback provided");
            return;
        }

        try {
            const browserService = runtime.getService<IBrowserService>(
                ServiceType.BROWSER
            );

            if (!browserService) {
                callback(
                    {
                        text: "I'm unable to browse the web right now as the browser service is not available.",
                        action: "BROWSE",
                    },
                    []
                );
                return;
            }

            // Extract search query from message
            const query = message.content.text;

            // Use a search engine URL with the query
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

            // Get the search results page content
            const searchContent = await browserService.getPageContent(
                searchUrl,
                runtime
            );

            // Extract relevant URLs from search results
            const urls = extractUrls(searchContent.bodyContent);

            // Fetch content from each URL
            let allContent = "";
            for (const url of urls.slice(0, 3)) {
                // Limit to first 3 results
                try {
                    const content = await browserService.getPageContent(
                        url,
                        runtime
                    );
                    allContent += `\n\nFrom ${url}:\nTitle: ${content.title}\n${content.bodyContent}`;
                } catch (error) {
                    console.error(`Error fetching content from ${url}:`, error);
                }
            }

            callback(
                {
                    text: `Based on my web search, here's what I found:\n${allContent}`,
                    action: "BROWSE",
                },
                []
            );
        } catch (error) {
            console.error("Error in BROWSE action:", error);
            callback(
                {
                    text: "I encountered an error while trying to browse the web. Please try again.",
                    action: "BROWSE",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What are the latest news about AI?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me search for the most recent news... *browses tech news sites*",
                    action: "BROWSE",
                },
            },
        ],
    ],
};

// Helper function to extract URLs from search results
function extractUrls(content: string): string[] {
    // Simple regex to extract URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return Array.from(content.matchAll(urlRegex), (m) => m[0]);
}

export const webPlugin: Plugin = {
    name: "web",
    description: "Web browsing capabilities for Eliza",
    services: [new WebBrowserService()],
    actions: [BROWSE],
};
