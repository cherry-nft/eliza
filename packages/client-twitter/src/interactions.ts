import { Tweet } from "./types";

export async function processTweet(tweet: Tweet): Promise<void> {
    // Convert String object to string primitive
    const tweetId = String(tweet.rest_id || tweet.id).toString();

    if (!tweetId) {
        console.error("No tweet ID found");
        return;
    }

    try {
        // Process tweet logic here
        console.log(`Processing tweet ${tweetId}`);
    } catch (error) {
        console.error("Error processing tweet:", error);
    }
}
