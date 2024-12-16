import {
    IAgentRuntime,
    Plugin,
    Action,
    Memory,
    State,
    HandlerCallback,
    elizaLogger,
} from "@ai16z/eliza";
import createTwitterClient from "@ai16z/client-twitter";
import type { TwitterClient } from "@ai16z/client-twitter";

// Helper function to initialize Twitter client with proper typing
async function initTwitterClient(
    runtime: IAgentRuntime
): Promise<TwitterClient> {
    const client = createTwitterClient();
    await client.start(runtime);
    return client;
}

const extractTweetId = (url: string): string | null => {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
};

const FETCH_TWEET: Action = {
    name: "FETCH_TWEET",
    description: "Fetch and read the content of a tweet",
    similes: [
        "read tweet",
        "get tweet",
        "check tweet",
        "look at tweet",
        "show tweet",
        "fetch tweet",
    ],
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("TWITTER_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!callback) {
            console.error("[TwitterPlugin] No callback provided");
            return;
        }

        try {
            const urlMatch = message.content.text.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                callback(
                    {
                        text: "I couldn't find a tweet URL in your message. Please provide a valid tweet URL.",
                        action: "FETCH_TWEET",
                    },
                    []
                );
                return;
            }

            const tweetUrl = urlMatch[0];
            const tweetId = extractTweetId(tweetUrl);

            if (!tweetId) {
                callback(
                    {
                        text: "I couldn't extract a valid tweet ID from the URL. Please provide a valid tweet URL.",
                        action: "FETCH_TWEET",
                    },
                    []
                );
                return;
            }

            console.log("[TwitterPlugin] Attempting to fetch tweet:", tweetId);

            const twitterClient = await initTwitterClient(runtime);
            const tweetResponse = await twitterClient.getTweet(tweetId);

            if (!tweetResponse) {
                callback(
                    {
                        text: "I couldn't fetch that tweet. It might be deleted, private, or there might be an issue with Twitter's API.",
                        action: "FETCH_TWEET",
                    },
                    []
                );
                return;
            }

            const response = {
                text: `Here's what I found in that tweet:\n\n${tweetResponse.text}`,
                action: "FETCH_TWEET",
            };

            callback(response, []);
        } catch (error) {
            console.error(
                "[TwitterPlugin] Error in FETCH_TWEET action:",
                error
            );
            callback(
                {
                    text: "I encountered an error while trying to fetch the tweet. Please try again.",
                    action: "FETCH_TWEET",
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
                    text: "Check out this tweet: https://twitter.com/example/status/123456789",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me fetch that tweet for you...",
                    action: "FETCH_TWEET",
                },
            },
        ],
    ],
};

const POST_TWEET: Action = {
    name: "POST_TWEET",
    description: "Post a new tweet",
    similes: ["tweet", "post", "send tweet"],
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("TWITTER_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!callback) {
            console.error("[TwitterPlugin] No callback provided");
            return;
        }

        try {
            const twitterClient = await initTwitterClient(runtime);
            const content = message.content.text;

            callback(
                {
                    text: "I'm composing and posting your tweet...",
                    action: "POST_TWEET",
                },
                []
            );

            const result = await twitterClient.sendTweet(content);

            const body = await result.json();
            if (!body?.data?.create_tweet?.tweet_results?.result) {
                callback(
                    {
                        text: "I encountered an error while trying to post the tweet.",
                        action: "POST_TWEET",
                    },
                    []
                );
                return;
            }

            const tweetResult = body.data.create_tweet.tweet_results.result;
            const tweetUrl = `https://twitter.com/${runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`;

            callback(
                {
                    text: `I've successfully posted your tweet! You can view it here: ${tweetUrl}`,
                    action: "POST_TWEET",
                },
                []
            );
        } catch (error) {
            console.error("[TwitterPlugin] Error in POST_TWEET action:", error);
            callback(
                {
                    text: "I encountered an error while trying to post the tweet. Please try again.",
                    action: "POST_TWEET",
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
                    text: "Post this tweet: Just had an amazing conversation with my AI friend!",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'm composing and posting your tweet...",
                    action: "POST_TWEET",
                },
            },
        ],
    ],
};

const LIKE_TWEET: Action = {
    name: "LIKE_TWEET",
    description: "Like a tweet",
    similes: ["like tweet", "heart tweet", "favorite tweet"],
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("TWITTER_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!callback) {
            console.error("[TwitterPlugin] No callback provided");
            return;
        }

        try {
            const urlMatch = message.content.text.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                callback(
                    {
                        text: "I couldn't find a tweet URL in your message. Please provide a valid tweet URL to like.",
                        action: "LIKE_TWEET",
                    },
                    []
                );
                return;
            }

            const tweetUrl = urlMatch[0];
            const tweetId = extractTweetId(tweetUrl);

            if (!tweetId) {
                callback(
                    {
                        text: "I couldn't extract a valid tweet ID from the URL. Please provide a valid tweet URL.",
                        action: "LIKE_TWEET",
                    },
                    []
                );
                return;
            }

            const twitterClient = await initTwitterClient(runtime);

            callback(
                {
                    text: "I'm liking the tweet for you...",
                    action: "LIKE_TWEET",
                },
                []
            );

            const tweetResponse = await twitterClient.getTweet(tweetId);
            if (!tweetResponse) {
                callback(
                    {
                        text: "I couldn't find that tweet. It might be deleted, private, or there might be an issue with Twitter's API.",
                        action: "LIKE_TWEET",
                    },
                    []
                );
                return;
            }

            await twitterClient.likeTweet(tweetResponse.id);

            callback(
                {
                    text: "I've successfully liked the tweet for you! ❤️",
                    action: "LIKE_TWEET",
                },
                []
            );
        } catch (error) {
            console.error("[TwitterPlugin] Error in LIKE_TWEET action:", error);
            callback(
                {
                    text: "I encountered an error while trying to like the tweet. Please try again.",
                    action: "LIKE_TWEET",
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
                    text: "Like this tweet: https://twitter.com/example/status/123456789",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'm liking the tweet for you...",
                    action: "LIKE_TWEET",
                },
            },
        ],
    ],
};

const RETWEET: Action = {
    name: "RETWEET",
    description: "Retweet a tweet",
    similes: ["retweet", "rt", "share tweet"],
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("TWITTER_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!callback) {
            console.error("[TwitterPlugin] No callback provided");
            return;
        }

        try {
            const urlMatch = message.content.text.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                callback(
                    {
                        text: "I couldn't find a tweet URL in your message. Please provide a valid tweet URL to retweet.",
                        action: "RETWEET",
                    },
                    []
                );
                return;
            }

            const tweetUrl = urlMatch[0];
            const tweetId = extractTweetId(tweetUrl);

            if (!tweetId) {
                callback(
                    {
                        text: "I couldn't extract a valid tweet ID from the URL. Please provide a valid tweet URL.",
                        action: "RETWEET",
                    },
                    []
                );
                return;
            }

            const twitterClient = await initTwitterClient(runtime);

            callback(
                {
                    text: "I'm retweeting that for you...",
                    action: "RETWEET",
                },
                []
            );

            const tweetResponse = await twitterClient.getTweet(tweetId);
            if (!tweetResponse) {
                callback(
                    {
                        text: "I couldn't find that tweet. It might be deleted, private, or there might be an issue with Twitter's API.",
                        action: "RETWEET",
                    },
                    []
                );
                return;
            }

            await twitterClient.retweet(tweetResponse.id);

            callback(
                {
                    text: "I've successfully retweeted that for you! 🔄",
                    action: "RETWEET",
                },
                []
            );
        } catch (error) {
            console.error("[TwitterPlugin] Error in RETWEET action:", error);
            callback(
                {
                    text: "I encountered an error while trying to retweet. Please try again.",
                    action: "RETWEET",
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
                    text: "Retweet this: https://twitter.com/example/status/123456789",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'm retweeting that for you...",
                    action: "RETWEET",
                },
            },
        ],
    ],
};

export const twitterPlugin: Plugin = {
    name: "twitter",
    description: "Twitter integration for Eliza",
    actions: [FETCH_TWEET, POST_TWEET, LIKE_TWEET, RETWEET],
};
