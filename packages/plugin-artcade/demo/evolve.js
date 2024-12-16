const fs = require('fs').promises;
const path = require('path');
const { ArtcadePlugin } = require('../dist');

async function evolveHTML() {
    try {
        const inputHTML = await fs.readFile(path.join(__dirname, '../src/__tests__/fixtures/spinwheel-test2.html'), 'utf-8');

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

        // Just write the HTML directly to a file called output.html
        await fs.writeFile('output.html', evolved.organism.html);
        console.log('HTML saved to output.html');

    } catch (error) {
        console.error('Evolution failed:', error);
    }
}

evolveHTML();