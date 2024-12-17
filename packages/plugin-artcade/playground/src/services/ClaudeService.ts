import artcadePrompt from "../public/artcade-prompt.md?raw";

interface ClaudeResponse {
    plan: {
        coreMechanics: string[];
        visualElements: string[];
        interactionFlow: string[];
        stateManagement: string[];
        assetRequirements: string[];
    };
    title: string;
    description: string;
    html: string;
    thumbnail: {
        alt: string;
        backgroundColor: string;
        elements: Array<{
            type: "rect" | "circle" | "path";
            attributes: Record<string, string>;
        }>;
    };
}

const generatePrompt = (userPrompt: string) => {
    return `You are an expert web developer tasked with creating an interactive HTML experience. First, analyze this prompt and break it down into components:

"${userPrompt}"

1. First return a JSON planning object with these fields:
{
  "coreMechanics": string[],    // Key interactive features
  "visualElements": string[],    // Visual and UI components
  "interactionFlow": string[],   // User interaction patterns
  "stateManagement": string[],   // Data and state tracking
  "assetRequirements": string[]  // Required visual/audio assets
}

2. Then, based on this plan, create a single HTML file that implements the features.
The response must be valid JSON. Format the HTML as a regular string (not template literal).
Do not use backticks in the HTML content.

Return in this format:
{
  "plan": {planning object},
  "title": string,
  "description": string,
  "html": string,
  "thumbnail": {
    "alt": string,
    "backgroundColor": string,
    "elements": Array<{
      "type": "rect" | "circle" | "path",
      "attributes": Record<string, string>
    }>
  }
}`;
};

class ClaudeService {
    private readonly OPENROUTER_API_KEY: string;
    private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";

    constructor() {
        this.OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
        if (!this.OPENROUTER_API_KEY) {
            console.warn(
                "OpenRouter API key not found in environment variables"
            );
        }
    }

    async generatePattern(userPrompt: string): Promise<ClaudeResponse> {
        console.log("Generating pattern for prompt:", userPrompt);

        try {
            console.log("Making request to OpenRouter API...");
            const requestBody = {
                model: "anthropic/claude-3.5-sonnet:beta",
                messages: [
                    {
                        role: "user",
                        content: generatePrompt(userPrompt),
                    },
                ],
            };
            console.log("Request body:", JSON.stringify(requestBody, null, 2));

            const response = await fetch(this.API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": "https://cursor.sh",
                    "X-Title": "Cursor",
                },
                body: JSON.stringify(requestBody),
            });

            console.log("Response status:", response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error("API error response:", errorText);
                throw new Error(
                    `API request failed: ${response.statusText} (${response.status})\n${errorText}`
                );
            }

            const data = await response.json();
            console.log("Raw API response:", JSON.stringify(data, null, 2));

            if (!data.choices?.[0]?.message?.content) {
                console.error("Unexpected API response structure:", data);
                throw new Error("Invalid API response structure");
            }

            let content = data.choices[0].message.content;
            console.log("Claude's raw response:", content);

            // Handle potential markdown formatting
            if (content.includes("```")) {
                console.log("Detected markdown code block, extracting JSON...");
                content = content
                    .split("```")[1]
                    .replace(/^json\n/, "")
                    .trim();
                console.log("Extracted content:", content);
            }

            // Parse the JSON response from Claude
            try {
                console.log("Attempting to parse response as JSON...");
                const fullResponse = JSON.parse(content);
                console.log("Successfully parsed JSON:", fullResponse);

                // Validate the response structure
                if (
                    !fullResponse.plan ||
                    !fullResponse.title ||
                    !fullResponse.html ||
                    !fullResponse.thumbnail
                ) {
                    console.error(
                        "Missing required fields in response:",
                        fullResponse
                    );
                    throw new Error("Response missing required fields");
                }

                // Convert the response to match our expected format
                const pattern: ClaudeResponse = {
                    plan: fullResponse.plan,
                    title: fullResponse.title,
                    description: fullResponse.description,
                    html: fullResponse.html,
                    thumbnail: {
                        alt: fullResponse.thumbnail.alt,
                        backgroundColor: fullResponse.thumbnail.backgroundColor,
                        elements: fullResponse.thumbnail.elements,
                    },
                };
                return pattern;
            } catch (e) {
                console.error("Failed to parse Claude response:", e);
                console.error("Response content:", content);
                throw new Error(
                    `Invalid response format from Claude: ${e.message}`
                );
            }
        } catch (error) {
            console.error("Error in generatePattern:", error);
            throw error;
        }
    }

    private generateSVG(thumbnail: any): string {
        try {
            const elements = thumbnail.elements
                .map((el: any) => {
                    const attrs = Object.entries(el.attributes)
                        .map(([key, value]) => `${key}="${value}"`)
                        .join(" ");
                    return `<${el.type} ${attrs} />`;
                })
                .join("\n    ");

            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="${thumbnail.backgroundColor}" />
                ${elements}
            </svg>`;
        } catch (error) {
            console.error("Error generating SVG:", error);
            throw error;
        }
    }
}

export const claudeService = new ClaudeService();
