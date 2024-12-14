import { Action, IAgentRuntime, Plugin } from "@ai16z/eliza";

const CONTINUE: Action = {
    name: "CONTINUE",
    description: "Continue the current conversation flow",
    similes: ["proceed", "keep going", "continue"],
    examples: [],
    handler: async (runtime: IAgentRuntime) => {
        return { text: "Continuing..." };
    },
    validate: async () => true,
};

const IGNORE: Action = {
    name: "IGNORE",
    description: "Ignore specific messages",
    similes: ["skip", "disregard", "ignore"],
    examples: [],
    handler: async (runtime: IAgentRuntime) => {
        return { text: "Ignoring..." };
    },
    validate: async () => true,
};

const NONE: Action = {
    name: "NONE",
    description: "No action needed",
    similes: ["nothing", "no action", "none"],
    examples: [],
    handler: async (runtime: IAgentRuntime) => {
        return { text: "No action needed" };
    },
    validate: async () => true,
};

export const bootstrapPlugin: Plugin = {
    name: "bootstrap",
    description: "Essential baseline functionality for Eliza",
    actions: [CONTINUE, IGNORE, NONE],
};
