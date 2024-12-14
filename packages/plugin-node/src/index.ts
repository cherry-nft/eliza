import { IAgentRuntime, Plugin, Service, ServiceType } from "@ai16z/eliza";

class BrowserService extends Service {
    static get serviceType(): ServiceType {
        return ServiceType.BROWSER;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Initialize browser service
    }
}

class TextGenerationService extends Service {
    static get serviceType(): ServiceType {
        return ServiceType.TEXT_GENERATION;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Initialize text generation service
    }
}

export const createNodePlugin = (): Plugin => ({
    name: "node",
    description: "Core Node.js-based services for Eliza",
    services: [new BrowserService(), new TextGenerationService()],
});
