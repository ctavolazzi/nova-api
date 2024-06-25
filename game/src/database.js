import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function initializeDatabase() {
    const db = await open({
        filename: 'game.db',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS game_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            state TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES game_sessions(id)
        );
        
        CREATE TABLE IF NOT EXISTS action_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            action TEXT NOT NULL,
            result TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES game_sessions(id)
        );
    `);

    return db;
}

export { initializeDatabase };