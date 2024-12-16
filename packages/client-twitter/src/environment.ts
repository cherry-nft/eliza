import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const DEFAULT_MAX_TWEET_LENGTH = 280;

// Schema that supports both OAuth and username/password auth
export const twitterEnvSchema = z.object({
    // OAuth credentials
    TWITTER_API_KEY: z.string().min(1, "Twitter API key is required"),
    TWITTER_API_SECRET: z.string().min(1, "Twitter API secret is required"),
    TWITTER_ACCESS_TOKEN: z.string().min(1, "Twitter access token is required"),
    TWITTER_ACCESS_SECRET: z
        .string()
        .min(1, "Twitter access secret is required"),
    TWITTER_BEARER_TOKEN: z.string().optional(),

    // Username/password auth (optional fallback)
    TWITTER_USERNAME: z.string().min(1, "Twitter username is required"),
    TWITTER_PASSWORD: z.string().optional(),
    TWITTER_EMAIL: z
        .string()
        .email("Valid Twitter email is required")
        .optional(),
    TWITTER_COOKIES: z.string().optional(),

    // Other settings
    MAX_TWEET_LENGTH: z
        .string()
        .pipe(z.coerce.number().min(0).int())
        .default(DEFAULT_MAX_TWEET_LENGTH.toString()),
});

export type TwitterConfig = z.infer<typeof twitterEnvSchema>;

export async function validateTwitterConfig(
    runtime: IAgentRuntime
): Promise<TwitterConfig> {
    try {
        const config = {
            // OAuth settings
            TWITTER_API_KEY:
                runtime.getSetting("TWITTER_API_KEY") ||
                process.env.TWITTER_API_KEY,
            TWITTER_API_SECRET:
                runtime.getSetting("TWITTER_API_SECRET") ||
                process.env.TWITTER_API_SECRET,
            TWITTER_ACCESS_TOKEN:
                runtime.getSetting("TWITTER_ACCESS_TOKEN") ||
                process.env.TWITTER_ACCESS_TOKEN,
            TWITTER_ACCESS_SECRET:
                runtime.getSetting("TWITTER_ACCESS_SECRET") ||
                process.env.TWITTER_ACCESS_SECRET,
            TWITTER_BEARER_TOKEN:
                runtime.getSetting("TWITTER_BEARER_TOKEN") ||
                process.env.TWITTER_BEARER_TOKEN,

            // Username/password settings
            TWITTER_USERNAME:
                runtime.getSetting("TWITTER_USERNAME") ||
                process.env.TWITTER_USERNAME,
            TWITTER_PASSWORD:
                runtime.getSetting("TWITTER_PASSWORD") ||
                process.env.TWITTER_PASSWORD,
            TWITTER_EMAIL:
                runtime.getSetting("TWITTER_EMAIL") ||
                process.env.TWITTER_EMAIL,
            TWITTER_COOKIES:
                runtime.getSetting("TWITTER_COOKIES") ||
                process.env.TWITTER_COOKIES,

            // Other settings
            MAX_TWEET_LENGTH:
                runtime.getSetting("MAX_TWEET_LENGTH") ||
                process.env.MAX_TWEET_LENGTH ||
                DEFAULT_MAX_TWEET_LENGTH.toString(),
        };

        return twitterEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Twitter configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
