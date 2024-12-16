import {
    Content,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    State,
    UUID,
    getEmbeddingZeroVector,
    elizaLogger,
    stringToUuid,
} from "@ai16z/eliza";
import {
    QueryTweetsResponse,
    Scraper,
    SearchMode,
    Tweet as AgentTweet,
} from "agent-twitter-client";
import { EventEmitter } from "events";
import type { Tweet } from "./types";

function convertToInternalTweet(tweet: AgentTweet): Tweet {
    return {
        id: tweet.id || "",
        text: tweet.text || "",
        userId: tweet.userId || "",
        username: tweet.username,
        name: tweet.name,
        timestamp: tweet.timestamp || 0,
        conversationId: tweet.conversationId || "",
        inReplyToStatusId: tweet.inReplyToStatusId,
        permanentUrl: tweet.permanentUrl || "",
        hashtags: tweet.hashtags || [],
        mentions: tweet.mentions || [],
        photos: tweet.photos || [],
        urls: tweet.urls || [],
        videos: tweet.videos || [],
        thread: (tweet.thread || []).map(convertToInternalTweet),
        rest_id: tweet.id,
        legacy: {
            full_text: tweet.text || "",
            created_at: new Date(tweet.timestamp * 1000).toISOString(),
            user_id_str: tweet.userId || "",
            conversation_id_str: tweet.conversationId || "",
            in_reply_to_status_id_str: tweet.inReplyToStatusId || undefined,
        },
    };
}

export function extractAnswer(text: string): string {
    const startIndex = text.indexOf("Answer: ") + 8;
    const endIndex = text.indexOf("<|endoftext|>", 11);
    return text.slice(startIndex, endIndex);
}

type TwitterProfile = {
    id: string;
    username: string;
    screenName: string;
    bio: string;
    nicknames: string[];
};

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

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

export class ClientBase extends EventEmitter {
    static _twitterClients: { [accountIdentifier: string]: Scraper } = {};
    twitterClient: Scraper;
    runtime: IAgentRuntime;
    directions: string;
    lastCheckedTweetId: bigint | null = null;
    imageDescriptionService: IImageDescriptionService;
    temperature: number = 0.5;

    requestQueue: RequestQueue = new RequestQueue();

    profile: TwitterProfile | null;

    async cacheTweet(tweet: Tweet): Promise<void> {
        if (!tweet) {
            console.warn("Tweet is undefined, skipping cache");
            return;
        }

        this.runtime.cacheManager.set(`twitter/tweets/${tweet.id}`, tweet);
    }

    async getCachedTweet(tweetId: string): Promise<Tweet | undefined> {
        const cached = await this.runtime.cacheManager.get<Tweet>(
            `twitter/tweets/${tweetId}`
        );

        return cached;
    }

    async getTweet(tweetId: string): Promise<Tweet> {
        const cachedTweet = await this.getCachedTweet(tweetId);

        if (cachedTweet) {
            return cachedTweet;
        }

        const tweet = await this.requestQueue.add(() =>
            this.twitterClient.getTweet(tweetId)
        );

        const internalTweet = convertToInternalTweet(tweet);
        await this.cacheTweet(internalTweet);
        return internalTweet;
    }

    callback: (self: ClientBase) => any = null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        const username = this.runtime.getSetting("TWITTER_USERNAME");
        if (ClientBase._twitterClients[username]) {
            this.twitterClient = ClientBase._twitterClients[username];
        } else {
            this.twitterClient = new Scraper();
            ClientBase._twitterClients[username] = this.twitterClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        console.log("🚀 [DEBUG] Starting Twitter client initialization");

        const username = this.runtime.getSetting("TWITTER_USERNAME");
        console.log("🚀 [DEBUG] Twitter username from settings:", username);

        if (!username) {
            console.log("❌ [DEBUG] No Twitter username configured");
            throw new Error("No Twitter username configured");
        }

        // Check for Twitter cookies
        console.log("🚀 [DEBUG] Checking for Twitter cookies");
        if (this.runtime.getSetting("TWITTER_COOKIES")) {
            console.log("🚀 [DEBUG] Found cookies in settings, parsing them");
            const cookiesArray = JSON.parse(
                this.runtime.getSetting("TWITTER_COOKIES")
            );
            await this.setCookiesFromArray(cookiesArray);
            console.log("✅ [DEBUG] Cookies set from settings");
        } else {
            console.log("🚀 [DEBUG] Checking for cached cookies");
            const cachedCookies = await this.getCachedCookies(username);
            if (cachedCookies) {
                console.log("✅ [DEBUG] Found cached cookies, setting them");
                await this.setCookiesFromArray(cachedCookies);
            } else {
                console.log("ℹ️ [DEBUG] No cached cookies found");
            }
        }

        console.log("🚀 [DEBUG] Attempting Twitter login");
        elizaLogger.log("Waiting for Twitter login");
        while (true) {
            console.log("🚀 [DEBUG] Login attempt starting");
            try {
                await this.twitterClient.login(
                    username,
                    this.runtime.getSetting("TWITTER_PASSWORD"),
                    this.runtime.getSetting("TWITTER_EMAIL"),
                    this.runtime.getSetting("TWITTER_2FA_SECRET") || undefined
                );

                if (await this.twitterClient.isLoggedIn()) {
                    console.log("✅ [DEBUG] Successfully logged in to Twitter");
                    const cookies = await this.twitterClient.getCookies();
                    await this.cacheCookies(username, cookies);
                    break;
                }

                console.log("❌ [DEBUG] Login attempt failed, will retry");
                elizaLogger.error("Failed to login to Twitter trying again...");

                await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (error) {
                console.log("❌ [DEBUG] Error during login attempt:", error);
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        // Initialize Twitter profile
        console.log("🚀 [DEBUG] Attempting to fetch Twitter profile");
        this.profile = await this.fetchProfile(username);

        if (this.profile) {
            console.log("✅ [DEBUG] Twitter profile loaded:", {
                id: this.profile.id,
                username: this.profile.username,
                screenName: this.profile.screenName,
            });
            elizaLogger.log("Twitter user ID:", this.profile.id);
            elizaLogger.log(
                "Twitter loaded:",
                JSON.stringify(this.profile, null, 10)
            );
            // Store profile info for use in responses
            this.runtime.character.twitterProfile = {
                id: this.profile.id,
                username: this.profile.username,
                screenName: this.profile.screenName,
                bio: this.profile.bio,
                nicknames: this.profile.nicknames,
            };
        } else {
            console.log("❌ [DEBUG] Failed to load Twitter profile");
            throw new Error("Failed to load profile");
        }

        console.log("🚀 [DEBUG] Loading latest checked tweet ID");
        await this.loadLatestCheckedTweetId();
        console.log("🚀 [DEBUG] Populating timeline");
        await this.populateTimeline();
        console.log("✅ [DEBUG] Twitter client initialization complete");
    }

    async fetchOwnPosts(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching own posts");
        const homeTimeline = await this.twitterClient.getUserTweets(
            this.profile.id,
            count
        );
        return homeTimeline.tweets.map(convertToInternalTweet);
    }

    async fetchHomeTimeline(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching home timeline");
        const homeTimeline = await this.twitterClient.fetchHomeTimeline(
            count,
            []
        );

        elizaLogger.debug(homeTimeline, { depth: Infinity });
        return homeTimeline
            .filter((t) => t.__typename !== "TweetWithVisibilityResults")
            .map(convertToInternalTweet);
    }

    async fetchTimelineForActions(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching timeline for actions");
        const homeTimeline = await this.twitterClient.fetchHomeTimeline(
            count,
            []
        );

        return homeTimeline.map(convertToInternalTweet);
    }

    async fetchSearchTweets(
        query: string,
        maxTweets: number,
        searchMode: SearchMode,
        cursor?: string
    ): Promise<QueryTweetsResponse> {
        try {
            // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
            // if we dont get a response in 5 seconds, something is wrong
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ tweets: [] }), 10000)
            );

            try {
                const result = await this.requestQueue.add(
                    async () =>
                        await Promise.race([
                            this.twitterClient.fetchSearchTweets(
                                query,
                                maxTweets,
                                searchMode,
                                cursor
                            ),
                            timeoutPromise,
                        ])
                );
                return {
                    tweets: ((result as any)?.tweets || []).map(
                        convertToInternalTweet
                    ),
                };
            } catch (error) {
                elizaLogger.error("Error fetching search tweets:", error);
                return { tweets: [] };
            }
        } catch (error) {
            elizaLogger.error("Error fetching search tweets:", error);
            return { tweets: [] };
        }
    }

    private async populateTimeline() {
        elizaLogger.debug("populating timeline...");

        const cachedTimeline = await this.getCachedTimeline();

        // Check if the cache file exists
        if (cachedTimeline) {
            // Read the cached search results from the file

            // Get the existing memories from the database
            const existingMemories =
                await this.runtime.messageManager.getMemoriesByRoomIds({
                    roomIds: cachedTimeline.map((tweet) =>
                        stringToUuid(
                            tweet.conversationId + "-" + this.runtime.agentId
                        )
                    ),
                });

            //TODO: load tweets not in cache?

            // Create a Set to store the IDs of existing memories
            const existingMemoryIds = new Set(
                existingMemories.map((memory) => memory.id.toString())
            );

            // Check if any of the cached tweets exist in the existing memories
            const someCachedTweetsExist = cachedTimeline.some((tweet) =>
                existingMemoryIds.has(
                    stringToUuid(tweet.id + "-" + this.runtime.agentId)
                )
            );

            if (someCachedTweetsExist) {
                // Filter out the cached tweets that already exist in the database
                const tweetsToSave = cachedTimeline.filter(
                    (tweet) =>
                        !existingMemoryIds.has(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        )
                );

                console.log({
                    processingTweets: tweetsToSave
                        .map((tweet) => tweet.id)
                        .join(","),
                });

                // Save the missing tweets as memories
                for (const tweet of tweetsToSave) {
                    elizaLogger.log("Saving Tweet", tweet.id);

                    const roomId = stringToUuid(
                        tweet.conversationId + "-" + this.runtime.agentId
                    );

                    const userId =
                        tweet.userId === this.profile.id
                            ? this.runtime.agentId
                            : stringToUuid(tweet.userId);

                    if (tweet.userId === this.profile.id) {
                        await this.runtime.ensureConnection(
                            this.runtime.agentId,
                            roomId,
                            this.profile.username,
                            this.profile.screenName,
                            "twitter"
                        );
                    } else {
                        await this.runtime.ensureConnection(
                            userId,
                            roomId,
                            tweet.username,
                            tweet.name,
                            "twitter"
                        );
                    }

                    const content = {
                        text: tweet.text,
                        url: tweet.permanentUrl,
                        source: "twitter",
                        inReplyTo: tweet.inReplyToStatusId
                            ? stringToUuid(
                                  tweet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    } as Content;

                    elizaLogger.log("Creating memory for tweet", tweet.id);

                    // check if it already exists
                    const memory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        );

                    if (memory) {
                        elizaLogger.log(
                            "Memory already exists, skipping timeline population"
                        );
                        break;
                    }

                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                        userId,
                        content: content,
                        agentId: this.runtime.agentId,
                        roomId,
                        embedding: getEmbeddingZeroVector(),
                        createdAt: tweet.timestamp * 1000,
                    });

                    await this.cacheTweet(tweet);
                }

                elizaLogger.log(
                    `Populated ${tweetsToSave.length} missing tweets from the cache.`
                );
                return;
            }
        }

        const timeline = await this.fetchHomeTimeline(cachedTimeline ? 10 : 50);

        // Get the most recent 20 mentions and interactions
        const mentionsAndInteractions = await this.fetchSearchTweets(
            `@${this.runtime.getSetting("TWITTER_USERNAME")}`,
            20,
            SearchMode.Latest
        );

        // Combine the timeline tweets and mentions/interactions
        const allTweets = [...timeline, ...mentionsAndInteractions.tweets];

        // Create a Set to store unique tweet IDs
        const tweetIdsToCheck = new Set<string>();
        const roomIds = new Set<UUID>();

        // Add tweet IDs to the Set
        for (const tweet of allTweets) {
            tweetIdsToCheck.add(tweet.id);
            roomIds.add(
                stringToUuid(tweet.conversationId + "-" + this.runtime.agentId)
            );
        }

        // Check the existing memories in the database
        const existingMemories =
            await this.runtime.messageManager.getMemoriesByRoomIds({
                roomIds: Array.from(roomIds),
            });

        // Create a Set to store the existing memory IDs
        const existingMemoryIds = new Set<UUID>(
            existingMemories.map((memory) => memory.id)
        );

        // Filter out the tweets that already exist in the database
        const tweetsToSave = allTweets.filter(
            (tweet) =>
                !existingMemoryIds.has(
                    stringToUuid(tweet.id + "-" + this.runtime.agentId)
                )
        );

        elizaLogger.debug({
            processingTweets: tweetsToSave.map((tweet) => tweet.id).join(","),
        });

        await this.runtime.ensureUserExists(
            this.runtime.agentId,
            this.profile.username,
            this.runtime.character.name,
            "twitter"
        );

        // Save the new tweets as memories
        for (const tweet of tweetsToSave) {
            elizaLogger.log("Saving Tweet", tweet.id);

            const roomId = stringToUuid(
                tweet.conversationId + "-" + this.runtime.agentId
            );
            const userId =
                tweet.userId === this.profile.id
                    ? this.runtime.agentId
                    : stringToUuid(tweet.userId);

            if (tweet.userId === this.profile.id) {
                await this.runtime.ensureConnection(
                    this.runtime.agentId,
                    roomId,
                    this.profile.username,
                    this.profile.screenName,
                    "twitter"
                );
            } else {
                await this.runtime.ensureConnection(
                    userId,
                    roomId,
                    tweet.username,
                    tweet.name,
                    "twitter"
                );
            }

            const content = {
                text: tweet.text,
                url: tweet.permanentUrl,
                source: "twitter",
                inReplyTo: tweet.inReplyToStatusId
                    ? stringToUuid(tweet.inReplyToStatusId)
                    : undefined,
            } as Content;

            await this.runtime.messageManager.createMemory({
                id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                userId,
                content: content,
                agentId: this.runtime.agentId,
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: tweet.timestamp * 1000,
            });

            await this.cacheTweet(tweet);
        }

        // Cache
        await this.cacheTimeline(timeline);
        await this.cacheMentions(mentionsAndInteractions.tweets);
    }

    async setCookiesFromArray(cookiesArray: any[]) {
        const cookieStrings = cookiesArray.map(
            (cookie) =>
                `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
                    cookie.secure ? "Secure" : ""
                }; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${
                    cookie.sameSite || "Lax"
                }`
        );
        await this.twitterClient.setCookies(cookieStrings);
    }

    async saveRequestMessage(message: Memory, state: State) {
        if (message.content.text) {
            const recentMessage = await this.runtime.messageManager.getMemories(
                {
                    roomId: message.roomId,
                    count: 1,
                    unique: false,
                }
            );

            if (
                recentMessage.length > 0 &&
                recentMessage[0].content === message.content
            ) {
                elizaLogger.debug("Message already saved", recentMessage[0].id);
            } else {
                await this.runtime.messageManager.createMemory({
                    ...message,
                    embedding: getEmbeddingZeroVector(),
                });
            }

            await this.runtime.evaluate(message, {
                ...state,
                twitterClient: this.twitterClient,
            });
        }
    }

    async loadLatestCheckedTweetId(): Promise<void> {
        const latestCheckedTweetId =
            await this.runtime.cacheManager.get<string>(
                `twitter/${this.profile.username}/latest_checked_tweet_id`
            );

        if (latestCheckedTweetId) {
            this.lastCheckedTweetId = BigInt(latestCheckedTweetId);
        }
    }

    async cacheLatestCheckedTweetId() {
        if (this.lastCheckedTweetId) {
            await this.runtime.cacheManager.set(
                `twitter/${this.profile.username}/latest_checked_tweet_id`,
                this.lastCheckedTweetId.toString()
            );
        }
    }

    async getCachedTimeline(): Promise<Tweet[] | undefined> {
        return await this.runtime.cacheManager.get<Tweet[]>(
            `twitter/${this.profile.username}/timeline`
        );
    }

    async cacheTimeline(timeline: Tweet[]) {
        await this.runtime.cacheManager.set(
            `twitter/${this.profile.username}/timeline`,
            timeline,
            { expires: Date.now() + 10 * 1000 }
        );
    }

    async cacheMentions(mentions: Tweet[]) {
        await this.runtime.cacheManager.set(
            `twitter/${this.profile.username}/mentions`,
            mentions,
            { expires: Date.now() + 10 * 1000 }
        );
    }

    async getCachedCookies(username: string) {
        return await this.runtime.cacheManager.get<any[]>(
            `twitter/${username}/cookies`
        );
    }

    async cacheCookies(username: string, cookies: any[]) {
        await this.runtime.cacheManager.set(
            `twitter/${username}/cookies`,
            cookies
        );
    }

    async getCachedProfile(username: string) {
        return await this.runtime.cacheManager.get<TwitterProfile>(
            `twitter/${username}/profile`
        );
    }

    async cacheProfile(profile: TwitterProfile) {
        await this.runtime.cacheManager.set(
            `twitter/${profile.username}/profile`,
            profile
        );
    }

    async fetchProfile(username: string): Promise<TwitterProfile> {
        const cached = await this.getCachedProfile(username);

        if (cached) return cached;

        try {
            const profile = await this.requestQueue.add(async () => {
                const profile = await this.twitterClient.getProfile(username);
                // console.log({ profile });
                return {
                    id: profile.userId,
                    username,
                    screenName: profile.name || this.runtime.character.name,
                    bio:
                        profile.biography ||
                        typeof this.runtime.character.bio === "string"
                            ? (this.runtime.character.bio as string)
                            : this.runtime.character.bio.length > 0
                              ? this.runtime.character.bio[0]
                              : "",
                    nicknames:
                        this.runtime.character.twitterProfile?.nicknames || [],
                } satisfies TwitterProfile;
            });

            this.cacheProfile(profile);

            return profile;
        } catch (error) {
            console.error("Error fetching Twitter profile:", error);

            return undefined;
        }
    }

    async fetchTweet(url: string): Promise<Tweet | null> {
        console.log("🚀 [DEBUG] Starting fetchTweet with URL:", url);
        elizaLogger.log(
            "🔍 [Twitter] Attempting to fetch tweet from URL:",
            url
        );
        try {
            // Extract tweet ID from URL
            const tweetId = this.extractTweetId(url);
            console.log("🚀 [DEBUG] Extracted tweet ID:", tweetId);
            elizaLogger.log("🔍 [Twitter] Extracted tweet ID:", tweetId);

            if (!tweetId) {
                console.log(
                    "❌ [DEBUG] Failed to extract tweet ID from URL:",
                    url
                );
                elizaLogger.error(
                    "❌ [Twitter] Failed to extract tweet ID from URL:",
                    url
                );
                return null;
            }

            // Check cache first
            const cachedTweet = await this.getCachedTweet(tweetId);
            console.log("🚀 [DEBUG] Cache check result:", !!cachedTweet);
            if (cachedTweet) {
                console.log("✅ [DEBUG] Found tweet in cache:", {
                    id: cachedTweet.id,
                    text: cachedTweet.text?.substring(0, 50) + "...",
                    author: cachedTweet.username,
                });
                elizaLogger.log("✅ [Twitter] Found tweet in cache:", {
                    id: cachedTweet.id,
                    text: cachedTweet.text,
                    author: cachedTweet.username,
                });
                return cachedTweet;
            }

            console.log(
                "🚀 [DEBUG] Tweet not in cache, preparing to fetch from API"
            );
            elizaLogger.log(
                "🔄 [Twitter] Tweet not in cache, fetching from API for ID:",
                tweetId
            );

            // Log the state of the Twitter client
            console.log("🚀 [DEBUG] Twitter client state:", {
                hasClient: !!this.twitterClient,
                hasRequestQueue: !!this.requestQueue,
                profile: this.profile
                    ? {
                          username: this.profile.username,
                          id: this.profile.id,
                      }
                    : null,
            });

            console.log("🚀 [DEBUG] About to call twitterClient.getTweet");
            const tweet = await this.requestQueue.add(() =>
                this.twitterClient.getTweet(tweetId)
            );
            console.log(
                "🚀 [DEBUG] API response received:",
                tweet ? "got data" : "null"
            );

            if (!tweet) {
                console.log(
                    "❌ [DEBUG] API returned null response for tweet ID:",
                    tweetId
                );
                elizaLogger.error(
                    "❌ [Twitter] API returned null response for tweet ID:",
                    tweetId
                );
                return null;
            }

            const internalTweet = convertToInternalTweet(tweet);
            await this.cacheTweet(internalTweet);
            return internalTweet;
        } catch (error) {
            console.log("❌ [DEBUG] Error in fetchTweet:", error);
            if (error instanceof Error) {
                console.log("❌ [DEBUG] Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
            elizaLogger.error("❌ [Twitter] Error fetching tweet:", error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
            return null;
        }
    }

    private extractTweetId(url: string): string | null {
        elizaLogger.log("🔍 [Twitter] Extracting tweet ID from URL:", url);
        try {
            const match = url.match(/\/status\/(\d+)/);
            const tweetId = match ? match[1] : null;
            elizaLogger.log("✅ [Twitter] Extracted tweet ID:", tweetId);
            return tweetId;
        } catch (error) {
            elizaLogger.error("❌ [Twitter] Error extracting tweet ID:", error);
            return null;
        }
    }
}
