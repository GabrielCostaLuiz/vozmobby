import { type SQLiteDatabase } from 'expo-sqlite';

export async function initializeDatabase(db: SQLiteDatabase) {
    try {
        // Schema creation
        await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS destinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        address TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Insert default data if empty
        const result = await db.getAllAsync<{ id: number }>('SELECT id FROM destinations LIMIT 1');
        if (result.length === 0) {
            await db.runAsync(
                'INSERT INTO destinations (title, address, icon, color) VALUES (?, ?, ?, ?)',
                'CASA', 'Rua das Flores, 123', 'home', '#FF0055'
            );
            await db.runAsync(
                'INSERT INTO destinations (title, address, icon, color) VALUES (?, ?, ?, ?)',
                'TRABALHO', 'Av. Paulista, 900', 'work', '#00CCFF'
            );
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}
