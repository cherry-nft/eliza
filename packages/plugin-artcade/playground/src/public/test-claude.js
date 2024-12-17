require('dotenv').config({ path: '.env.local' });
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const generatePrompt = (userPrompt) => {
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
}`
};

function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[:']/g, '') // Remove colons and apostrophes
    .replace(/[^a-z0-9-]/g, '-') // Replace other special chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

async function generateExperience(prompt) {
  try {
    console.log('Generating experience for prompt:', prompt);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: generatePrompt(prompt)
      }],
      temperature: 1.0,
    });

    // Extract JSON from the response, handling potential markdown formatting
    let jsonStr = message.content[0].text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].replace(/^json\n/, '').trim();
    }

    const response = JSON.parse(jsonStr);

    // Validate the plan
    if (!response.plan || !response.plan.coreMechanics || !response.plan.visualElements) {
      throw new Error('Invalid generation plan structure');
    }

    // Log the plan for debugging
    console.log('\nGeneration Plan:');
    console.log('Core Mechanics:', response.plan.coreMechanics);
    console.log('Visual Elements:', response.plan.visualElements);
    console.log('Interaction Flow:', response.plan.interactionFlow);

    const id = sanitizeFilename(response.title);

    // Create directories if they don't exist
    await fs.mkdir('public/artcade/experiences', { recursive: true });
    await fs.mkdir('public/artcade/thumbnails', { recursive: true });

    // Save HTML file
    const htmlPath = `public/artcade/experiences/${id}.html`;
    await fs.writeFile(htmlPath, response.html);

    // Generate and save SVG thumbnail
    const svgContent = generateSVG(response.thumbnail);
    const svgPath = `public/artcade/thumbnails/${id}.svg`;
    await fs.writeFile(svgPath, svgContent);

    // Update experiences.ts
    await updateExperiencesFile(id, response);

    console.log('\nFiles saved:');
    console.log('HTML:', htmlPath);
    console.log('SVG:', svgPath);
    console.log('Experiences array updated');

    return response;
  } catch (error) {
    console.error('Error generating experience:', error);
    if (error.message.includes('JSON')) {
      console.error('JSON parsing failed. Response might be too complex.');
      console.error('Try breaking down the prompt into smaller components.');
    }
    throw error;
  }
}

async function updateExperiencesFile(id, response) {
  const experiencesPath = 'src/data/experiences.ts';

  // Read the current experiences file
  let content = '';
  try {
    content = await fs.readFile(experiencesPath, 'utf8');
  } catch (error) {
    console.error('Could not read experiences.ts:', error);
    throw error;
  }

  // Create new experience entry
  const newExperience = {
    id,
    title: response.title,
    description: response.description,
    url: `/artcade/experiences/${id}.html`,
    isGenerated: true,
    generatedAt: new Date().toISOString(),
    tokenData: {
      contractAddress: `0x${id.padStart(40, '0')}`,
      progress: 100,
      mcap: 50000,
      totalSupply: "100000",
      symbol: id.slice(0, 5).toUpperCase(),
      decimals: 18,
      name: `${response.title} Token`,
      timestamp: new Date().toISOString(),
      platform: "other"
    }
  };

  // Convert the new experience to a string with proper formatting
  const experienceString = `  {
    id: "${newExperience.id}",
    title: "${newExperience.title}",
    description: "${newExperience.description}",
    url: "${newExperience.url}",
    isGenerated: ${newExperience.isGenerated},
    generatedAt: "${newExperience.generatedAt}",
    tokenData: {
      contractAddress: "${newExperience.tokenData.contractAddress}" as \`0x\${string}\`,
      progress: ${newExperience.tokenData.progress},
      totalSupply: "${newExperience.tokenData.totalSupply}",
      mcap: ${newExperience.tokenData.mcap},
      symbol: "${newExperience.tokenData.symbol}",
      decimals: ${newExperience.tokenData.decimals},
      name: "${newExperience.tokenData.name}",
      timestamp: "${newExperience.tokenData.timestamp}",
      platform: "${newExperience.tokenData.platform}"
    }
  }`;

  // Find the experiences array in the file
  const arrayStartMatch = content.match(/export const experiences: Experience\[\] = \[/);
  if (!arrayStartMatch) {
    throw new Error('Could not find experiences array in experiences.ts');
  }

  // Insert the new experience at the start of the array
  const insertPosition = arrayStartMatch.index + arrayStartMatch[0].length;
  const newContent = content.slice(0, insertPosition) + '\n' + experienceString + ',' + content.slice(insertPosition);

  // Write the updated content back to the file
  await fs.writeFile(experiencesPath, newContent, 'utf8');
}

function generateSVG(thumbnail) {
  const elements = thumbnail.elements.map(el => {
    const attrs = Object.entries(el.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    return `<${el.type} ${attrs} />`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="${thumbnail.backgroundColor}" />
  ${elements}
</svg>`;
}

// Example usage
async function main() {
  const userPrompt = process.argv[2];
  if (!userPrompt) {
    console.error('Please provide a prompt as a command line argument');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Please set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  try {
    await generateExperience(userPrompt);
  } catch (error) {
    console.error('Failed to generate experience:', error);
    process.exit(1);
  }
}

main();