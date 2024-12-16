import { Client } from "@ai16z/eliza";

// Define the Mention type to match agent-twitter-client
export interface Mention {
    id: string;
    username?: string;
    name?: string;
    screen_name?: string;
}

// Unified Tweet interface that combines properties from both twitter-api-v2 and agent-twitter-client
export interface Tweet {
    // Common properties
    id?: string;
    text?: string;
    userId?: string;
    username?: string;
    name?: string;
    timestamp?: number;
    conversationId?: string;
    inReplyToStatusId?: string | null;
    permanentUrl?: string;

    // Media properties
    hashtags?: string[];
    mentions?: Mention[];
    photos?: any[];
    urls?: any[];
    videos?: any[];
    thread?: Tweet[];

    // twitter-api-v2 specific properties
    rest_id?: string;
    legacy?: {
        full_text: string;
        created_at: string;
        user_id_str: string;
        conversation_id_str: string;
        in_reply_to_status_id_str?: string;
        entities?: {
            hashtags: any[];
            user_mentions: Mention[];
            urls: any[];
            media?: any[];
        };
    };
    core?: {
        user_results?: {
            result?: {
                legacy?: {
                    screen_name: string;
                    name: string;
                    created_at: string;
                };
            };
        };
    };
}

// Response type for tweet creation
export interface CreateTweetResponse {
    data?: {
        create_tweet?: {
            tweet_results?: {
                result?: {
                    rest_id: string;
                    legacy: {
                        full_text: string;
                        created_at: string;
                        user_id_str: string;
                        conversation_id_str: string;
                        in_reply_to_status_id_str?: string;
                    };
                };
            };
        };
    };
}

// Twitter client interface that abstracts the underlying implementation
export interface ITwitterClient extends Client {
    getTweet(tweetId: string): Promise<Tweet>;
    sendTweet(content: string, inReplyTo?: string): Promise<Response>;
    likeTweet(tweetId: string): Promise<Response>;
    retweet(tweetId: string): Promise<Response>;
    deleteTweet(tweetId: string): Promise<Response>;
    getUserByUsername(
        username: string,
        includeDetails?: boolean
    ): Promise<Response>;
    followUser(userId: string): Promise<Response>;
    unfollowUser(userId: string): Promise<Response>;
    isFollowing(userId: string): Promise<Response>;
    getTimeline(): Promise<Response>;
    getMentions(): Promise<Response>;
}

// Re-export the TwitterClient class type
export type { TwitterClient } from "./index";
