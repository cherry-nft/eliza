import { TwitterResponse } from "@/types/twitter";

export function extractTweetId(url: string): string | null {
    const patterns = [
        /twitter\.com\/\w+\/status\/(\d+)/,
        /x\.com\/\w+\/status\/(\d+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

export async function fetchTweetData(
    tweetId: string
): Promise<TwitterResponse> {
    try {
        const response = await fetch(`/api/twitter/${tweetId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch tweet data");
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching tweet data:", error);
        throw error;
    }
}
