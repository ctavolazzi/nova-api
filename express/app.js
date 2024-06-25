import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';
import ollama from 'ollama';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let conversationHistory = [];

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all items
app.get('/items', (req, res) => {
    db.all('SELECT * FROM items', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get a single item by ID
app.get('/items/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    });
});

// Create a new item
app.post('/items', (req, res) => {
    const { name, description } = req.body;
    db.run('INSERT INTO items (name, description) VALUES (?, ?)', [name, description], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id: this.lastID, name, description });
    });
});

// Update an existing item
app.put('/items/:id', (req, res) => {
    const { name, description } = req.body;
    const id = req.params.id;
    db.run('UPDATE items SET name = ?, description = ? WHERE id = ?', [name, description, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ id, name, description });
        }
    });
});

// Delete an item
app.delete('/items/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.status(204).send();
        }
    });
});

// Chat with Ollama
app.get('/chat', async (req, res) => {
    const message = req.query.message;

    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Fetch items from the database to include in the chat context
    db.all('SELECT * FROM items', async (err, rows) => {
        if (err) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
            return;
        }

        const itemsList = rows.map(item => `${item.name}: ${item.description}`).join('\n');
        const chatConfig = {
            model: 'llama3',
            messages: [
                { role: 'system', content: `Items:\n${itemsList}` },
                ...conversationHistory
            ],
            stream: true
        };

        try {
            const response = await ollama.chat(chatConfig);

            for await (const part of response) {
                if (part.message) {
                    res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
                }
            }

            res.end();
        } catch (error) {
            console.error('Ollama error:', error);
            res.write(`data: ${JSON.stringify({ error: 'Failed to communicate with Ollama: ' + error.message })}\n\n`);
            res.end();
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
