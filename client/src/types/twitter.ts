export interface TwitterResponse {
    data: {
        id: string;
        text: string;
        created_at: string;
        public_metrics: {
            retweet_count: number;
            reply_count: number;
            like_count: number;
            quote_count: number;
        };
        author_id: string;
    };
    includes?: {
        users: Array<{
            id: string;
            username: string;
            profile_image_url: string;
        }>;
        media?: Array<{
            media_key: string;
            type: string;
            url?: string;
            preview_image_url?: string;
            width?: number;
            height?: number;
            variants?: Array<{
                bit_rate?: number;
                content_type: string;
                url: string;
            }>;
        }>;
    };
}
