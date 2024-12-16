import { IAgentRuntime, Client, elizaLogger } from "@ai16z/eliza";
import { validateTwitterConfig } from "./environment.ts";
import { TwitterApi } from "twitter-api-v2";
import type { Tweet, ITwitterClient } from "./types";

// Re-export types
export type { Tweet, ITwitterClient } from "./types";

class RequestQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing: boolean = false;

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        try {
            const request = this.queue.shift();
            if (request) await request();
        } finally {
            this.processing = false;
            if (this.queue.length > 0) {
                setTimeout(() => this.processQueue(), 1000); // Rate limit delay
            }
        }
    }
}

// Export the TwitterClient class
export class TwitterClient implements Client, ITwitterClient {
    private twitterClient?: TwitterApi;
    private requestQueue: RequestQueue;

    constructor() {
        this.requestQueue = new RequestQueue();
    }

    async start(runtime: IAgentRuntime): Promise<this> {
        await validateTwitterConfig(runtime);
        elizaLogger.log("Twitter client started");

        const apiKey = runtime.getSetting("TWITTER_API_KEY");
        const apiSecret = runtime.getSetting("TWITTER_API_SECRET");
        const accessToken = runtime.getSetting("TWITTER_ACCESS_TOKEN");
        const accessSecret = runtime.getSetting("TWITTER_ACCESS_SECRET");

        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
            throw new Error("Missing required Twitter OAuth credentials");
        }

        this.twitterClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken: accessToken,
            accessSecret: accessSecret,
        });

        return this;
    }

    async stop() {
        elizaLogger.warn("Twitter client stopped");
    }

    // Core Twitter methods
    async getTweet(tweetId: string): Promise<Tweet> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const result = await this.twitterClient!.v2.tweet(tweetId);
            return this.mapToTweet(result.data);
        });
    }

    async likeTweet(tweetId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const userId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.like(userId, tweetId);
            return new Response(JSON.stringify(result));
        });
    }

    async retweet(tweetId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const userId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.retweet(
                userId,
                tweetId
            );
            return new Response(JSON.stringify(result));
        });
    }

    async sendTweet(content: string, inReplyTo?: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const result = await this.twitterClient!.v2.tweet(content, {
                reply: inReplyTo
                    ? { in_reply_to_tweet_id: inReplyTo }
                    : undefined,
            });
            return new Response(JSON.stringify(result));
        });
    }

    async deleteTweet(tweetId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const result = await this.twitterClient!.v2.deleteTweet(tweetId);
            return new Response(JSON.stringify(result));
        });
    }

    async getUserByUsername(
        username: string,
        _includeDetails: boolean = false
    ): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const result =
                await this.twitterClient!.v2.userByUsername(username);
            return new Response(JSON.stringify(result));
        });
    }

    async followUser(userId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const sourceUserId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.follow(
                sourceUserId,
                userId
            );
            return new Response(JSON.stringify(result));
        });
    }

    async unfollowUser(userId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const sourceUserId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.unfollow(
                sourceUserId,
                userId
            );
            return new Response(JSON.stringify(result));
        });
    }

    async isFollowing(_userId: string): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const sourceUserId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.following(sourceUserId);
            return new Response(JSON.stringify(result));
        });
    }

    async getTimeline(): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const userId = await this.getCurrentUserId();
            const result = await this.twitterClient!.v2.userTimeline(userId);
            return new Response(JSON.stringify(result));
        });
    }

    async getMentions(): Promise<Response> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        return await this.requestQueue.add(async () => {
            const userId = await this.getCurrentUserId();
            const result =
                await this.twitterClient!.v2.userMentionTimeline(userId);
            return new Response(JSON.stringify(result));
        });
    }

    private async getCurrentUserId(): Promise<string> {
        if (!this.twitterClient)
            throw new Error("Twitter client not initialized");
        const me = await this.twitterClient.v2.me();
        return me.data.id;
    }

    private mapToTweet(apiTweet: any): Tweet {
        return {
            id: apiTweet.id,
            text: apiTweet.text,
            userId: apiTweet.author_id,
            timestamp: new Date(apiTweet.created_at).getTime(),
            conversationId: apiTweet.conversation_id,
            inReplyToStatusId: apiTweet.in_reply_to_user_id,
            permanentUrl: `https://twitter.com/i/web/status/${apiTweet.id}`,
            hashtags: [],
            mentions: [],
            photos: [],
            urls: [],
            videos: [],
            thread: [],
            rest_id: apiTweet.id,
            legacy: {
                full_text: apiTweet.text,
                created_at: apiTweet.created_at,
                user_id_str: apiTweet.author_id,
                conversation_id_str: apiTweet.conversation_id,
                in_reply_to_status_id_str: apiTweet.in_reply_to_user_id,
            },
        };
    }
}

// Export factory function as default
export default function createTwitterClient(): TwitterClient {
    return new TwitterClient();
}
