const { Client } = require('pg');

async function testConnection() {
    const client = new Client(process.env.DATABASE_URL);
    try {
        await client.connect();
        const result = await client.query('SELECT 1');
        console.log('Connection successful:', result.rows);
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await client.end();
    }
}

testConnection();