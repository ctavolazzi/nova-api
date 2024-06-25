import express from 'express';
import ollama from 'ollama';
import { initializeDatabase } from './database.js';
import GameState from './game/gameState.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

let db;

app.post('/start-game', async (req, res) => {
    const { playerName, characterClass } = req.body;
    const result = await db.run('INSERT INTO game_sessions (player_name) VALUES (?)', playerName);
    const sessionId = result.lastID;
    
    const gameState = new GameState(sessionId, playerName, characterClass);
    
    await db.run('INSERT INTO game_states (session_id, state) VALUES (?, ?)',
        sessionId, JSON.stringify(gameState.toJSON()));
    
    res.json({ sessionId, gameState: gameState.toJSON() });
});

app.post('/game', async (req, res) => {
    const { sessionId, action } = req.body;
    
    const gameStateRow = await db.get('SELECT state FROM game_states WHERE session_id = ? ORDER BY id DESC LIMIT 1', sessionId);
    const gameState = JSON.parse(gameStateRow.state);
    
    const prompt = `
You are the Dungeon Master in a fantasy choose-your-own-adventure game. 
The current game state is: ${JSON.stringify(gameState)}
The player's action is: "${action}"

Respond with a JSON object containing:
1. A "description" of what happens next (1-2 sentences).
2. An array of 2-3 "choices" the player can make. Each choice should be a string.
3. Any updates to the "gameState" object.

Keep the story engaging and reactive to the player's choices.
`;

    try {
        const response = await ollama.generate({
            model: 'llama3',
            prompt: prompt,
            format: 'json'
        });

        const gameUpdate = JSON.parse(response.response);
        
        // Update the game state with any changes from Ollama
        Object.assign(gameState, gameUpdate.gameState);
        
        await db.run('INSERT INTO game_states (session_id, state) VALUES (?, ?)',
            sessionId, JSON.stringify(gameState));
        
        await db.run('INSERT INTO action_logs (session_id, action, result) VALUES (?, ?, ?)',
            sessionId, action, gameUpdate.description);

        res.json({
            description: gameUpdate.description,
            choices: gameUpdate.choices,
            gameState: gameState
        });
    } catch (error) {
        console.error('Ollama error:', error);
        res.status(500).json({ error: 'Failed to generate game update' });
    }
});

app.get('/load-game/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const gameStateRow = await db.get('SELECT state FROM game_states WHERE session_id = ? ORDER BY id DESC LIMIT 1', sessionId);
    if (gameStateRow) {
        res.json(JSON.parse(gameStateRow.state));
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

async function startServer() {
    db = await initializeDatabase();
    app.listen(port, () => {
        console.log(`Game server running at http://localhost:${port}`);
    });
}

startServer();