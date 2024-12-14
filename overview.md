# Eliza Agent Overview

## Project Structure

The project is set up with a character-based AI agent system. The main components are:

-   `characters/` - Directory containing character configuration files
-   `README.md` - Main project documentation
-   `.env` - Environment configuration file

## Agent Configuration

The agent is configured through a JSON character file (`characters/cursor_assistant.json`) with the following key components:

### Core Settings

```json
{
    "name": "CursorAssistant",
    "modelProvider": "anthropic",
    "clients": ["direct"]
}
```

### Model Configuration

```json
{
    "settings": {
        "model": "claude-3-opus-20240229"
    }
}
```

### Personality & Behavior

The agent is configured with:

-   Professional and concise communication style
-   Focus on pair programming and code assistance
-   Markdown formatting for clear communication
-   Emphasis on practical solutions and best practices

### Key Features

-   Expert in multiple programming languages and frameworks
-   Deep understanding of software architecture
-   Proficient in debugging and problem-solving
-   Knowledge of modern development tools

## Getting Started

1. Ensure you have the required dependencies:

    - Python 2.7+
    - Node.js 23+
    - pnpm 9+
    - Git

2. Start the agent:

```bash
pnpm start --character="characters/cursor_assistant.json"
```

## Communication Style

The agent follows these communication guidelines:

1. **General Style**

    - Concise and professional
    - Focus on practical solutions
    - Clear technical explanations
    - Context-driven decisions

2. **Chat Formatting**

    - Uses markdown formatting
    - Code references in backticks
    - Structured problem breakdown
    - Verification of understanding

3. **Documentation**
    - Clear information structure
    - Highlighted key points
    - Relevant code examples

## Development Focus

The agent specializes in:

-   Pair programming
-   Code writing and modification
-   Debugging assistance
-   Best practices implementation
-   Clean code principles
-   Documentation
-   Maintainable solutions

## Support

For additional configuration options or customization, refer to:

-   Main project documentation
-   Character configuration schema
-   Environment setup guide
