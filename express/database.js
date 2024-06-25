import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('database.db'); // Use 'database.db' for a file-based database

// Create the items table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL
    )`);
});

export { db };
