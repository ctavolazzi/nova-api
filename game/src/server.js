import express from 'express';
import ollama from 'ollama';
import { initializeDatabase } from './database.js';
import GameState from './game/gameState.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

let db;

app.get('/saved-games', async (req, res) => {
    try {
        const savedGames = await db.all('SELECT id, player_name, character_class, created_at FROM game_sessions ORDER BY created_at DESC');
        res.json(savedGames);
    } catch (error) {
        console.error('Error fetching saved games:', error);
        res.status(500).json({ error: 'Failed to fetch saved games' });
    }
});

app.post('/start-game', async (req, res) => {
    const { playerName, characterClass } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO game_sessions (player_name, character_class) VALUES (?, ?)',
            playerName, characterClass
        );
        const sessionId = result.lastID;
        
        const gameState = new GameState(sessionId, playerName, characterClass);
        
        await db.run('INSERT INTO game_states (session_id, current_scene, character_state, inventory) VALUES (?, ?, ?, ?)',
            sessionId, 
            gameState.currentScene,
            JSON.stringify(gameState.character),
            JSON.stringify(gameState.character.inventory)
        );
        
        res.json({ sessionId, gameState: gameState.toJSON() });
    } catch (error) {
        console.error('Error starting new game:', error);
        res.status(500).json({ error: 'Failed to start new game' });
    }
});

app.post('/game', async (req, res) => {
    const { sessionId, action } = req.body;
    
    try {
        const gameStateRow = await db.get('SELECT current_scene, character_state, inventory FROM game_states WHERE session_id = ? ORDER BY id DESC LIMIT 1', sessionId);
        if (!gameStateRow) {
            return res.status(404).json({ error: 'Game session not found' });
        }

        const gameState = GameState.fromJSON({
            sessionId,
            currentScene: gameStateRow.current_scene,
            character: JSON.parse(gameStateRow.character_state),
            inventory: JSON.parse(gameStateRow.inventory)
        });
        
        const prompt = `
You are the Dungeon Master in a fantasy choose-your-own-adventure game. 
The current game state is: ${JSON.stringify(gameState)}
The player's action is: "${action}"

Respond with a JSON object containing:
1. A "description" of what happens next (2-3 sentences).
2. An array of 3-4 "choices" for the player. Each choice should be an object with the following properties:
   - "text": A brief description of the choice (1 sentence)
   - "effects": An object describing the potential effects of this choice, including:
     - "health": Potential change to health (positive or negative number)
     - "stats": Potential changes to strength, dexterity, or intelligence (object with stat names and values)
     - "inventory": Items that might be gained or lost (object with "add" and "remove" objects, where keys are item names and values are quantities)
   - "difficulty": A string describing the perceived difficulty of the choice ("Easy", "Medium", "Hard")
3. Any immediate updates to the game state based on the player's last action.

Keep the story engaging and reactive to the player's choices.
`;

        const response = await ollama.generate({
            model: 'llama3',
            prompt: prompt,
            format: 'json'
        });

        const gameUpdate = JSON.parse(response.response);
        
        // Apply immediate state changes
        if (gameUpdate.stateChanges) {
            if (gameUpdate.stateChanges.inventory) {
                if (gameUpdate.stateChanges.inventory.add) {
                    for (const [item, quantity] of Object.entries(gameUpdate.stateChanges.inventory.add)) {
                        console.log(`Adding ${quantity} of ${item} to inventory`);
                        gameState.character.addToInventory(item, quantity);
                    }
                }
                if (gameUpdate.stateChanges.inventory.remove) {
                    for (const [item, quantity] of Object.entries(gameUpdate.stateChanges.inventory.remove)) {
                        console.log(`Removing ${quantity} of ${item} from inventory`);
                        gameState.character.removeFromInventory(item, quantity);
                    }
                }
            }
            if (gameUpdate.stateChanges.currentScene) {
                gameState.updateScene(gameUpdate.stateChanges.currentScene);
            }
            // Add more state changes as needed
        }
        
        await db.run('INSERT INTO game_states (session_id, current_scene, character_state, inventory) VALUES (?, ?, ?, ?)',
            sessionId, 
            gameState.currentScene,
            JSON.stringify(gameState.character),
            JSON.stringify(gameState.character.inventory)
        );
        
        await db.run('INSERT INTO action_logs (session_id, action, result, state_changes) VALUES (?, ?, ?, ?)',
            sessionId, action, gameUpdate.description, JSON.stringify(gameUpdate.stateChanges || {}));

        res.json({
            description: gameUpdate.description,
            choices: gameUpdate.choices,
            gameState: gameState.toJSON()  // Ensure this includes the full character state
        });
    } catch (error) {
        console.error('Error processing game action:', error);
        res.status(500).json({ error: 'Failed to process game action' });
    }
});

app.get('/load-game/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        const gameStateRow = await db.get('SELECT current_scene, character_state, inventory FROM game_states WHERE session_id = ? ORDER BY id DESC LIMIT 1', sessionId);
        if (gameStateRow) {
            const gameState = GameState.fromJSON({
                sessionId,
                currentScene: gameStateRow.current_scene,
                character: JSON.parse(gameStateRow.character_state),
                inventory: JSON.parse(gameStateRow.inventory)
            });
            res.json(gameState.toJSON());
        } else {
            res.status(404).json({ error: 'Game session not found' });
        }
    } catch (error) {
        console.error('Error loading game:', error);
        res.status(500).json({ error: 'Failed to load game' });
    }
});

app.post('/use-item', async (req, res) => {
    const { sessionId, item } = req.body;
    
    try {
        const gameStateRow = await db.get('SELECT current_scene, character_state, inventory FROM game_states WHERE session_id = ? ORDER BY id DESC LIMIT 1', sessionId);
        if (!gameStateRow) {
            return res.status(404).json({ error: 'Game session not found' });
        }

        const gameState = GameState.fromJSON({
            sessionId,
            currentScene: gameStateRow.current_scene,
            character: JSON.parse(gameStateRow.character_state),
            inventory: JSON.parse(gameStateRow.inventory)
        });
        
        const useResult = gameState.character.useItem(item);
        
        if (useResult !== "Item not found or has no effect.") {
            await db.run('INSERT INTO game_states (session_id, current_scene, character_state, inventory) VALUES (?, ?, ?, ?)',
                sessionId, 
                gameState.currentScene,
                JSON.stringify(gameState.character),
                JSON.stringify(gameState.character.inventory)
            );
            
            res.json({ success: true, effect: useResult, gameState: gameState.toJSON() });
        } else {
            res.json({ success: false, message: useResult });
        }
    } catch (error) {
        console.error('Error using item:', error);
        res.status(500).json({ error: 'Failed to use item' });
    }
});

async function startServer() {
    db = await initializeDatabase();
    app.listen(port, () => {
        console.log(`Game server running at http://localhost:${port}`);
    });
}

startServer();