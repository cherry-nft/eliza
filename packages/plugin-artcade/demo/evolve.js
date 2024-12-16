const fs = require('fs').promises;
const path = require('path');
const { ArtcadePlugin } = require('../dist');

async function evolveHTML() {
    try {
        const inputHTML = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
        
        const mockRuntime = {
            memory: new Map(),
            async get(key) { return this.memory.get(key); },
            async set(key, value) { this.memory.set(key, value); },
            async delete(key) { this.memory.delete(key); },
            getMemoryManager() {
                return {
                    get: async (key) => this.memory.get(key),
                    set: async (key, value) => this.memory.set(key, value),
                    delete: async (key) => this.memory.delete(key),
                    clear: async () => this.memory.clear(),
                    createMemory: async (key, value) => this.memory.set(key, value)
                };
            }
        };

        const plugin = new ArtcadePlugin();
        const engine = plugin.initializeEngine(mockRuntime);
        
        const evolved = await engine.evolve(inputHTML, {
            generations: 1,
            populationSize: 3,
            mutationRate: 0.8
        });

        // Get the actual HTML from the evolved result
        let evolvedHTML = '';

        if (evolved && evolved.organism && evolved.organism.html) {
            evolvedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evolved Game</title>
    <style>
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
${evolved.organism.html}
</body>
</html>`;
            console.log('Debug - using evolved HTML');
        } else {
            console.log('Failed to extract HTML, using input HTML as fallback');
            evolvedHTML = inputHTML;
        }

        // Save the evolved HTML
        const evolvedPath = path.join(__dirname, 'evolved.html');
        await fs.writeFile(evolvedPath, evolvedHTML, 'utf-8');

        console.log(`Evolved HTML saved to: ${evolvedPath}`);

        // Create a simple server to view the result
        const serverPath = path.join(__dirname, 'server.js');
        await fs.writeFile(serverPath, `
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    fs.readFile(path.join(__dirname, 'evolved.html'), (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading evolved.html');
            return;
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});`);

        console.log('To view the evolved HTML, run: node demo/server.js');
        console.log('Then open http://localhost:3000 in your browser');

    } catch (error) {
        console.error('Evolution failed:', error);
    }
}

evolveHTML();