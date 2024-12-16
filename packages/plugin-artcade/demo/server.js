
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
});