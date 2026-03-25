// Seed script to recreate and populate dataset.db
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATASET_DIR = path.join(__dirname, '../dataset/sap-o2c-data');
const DB_PATH = path.join(__dirname, 'dataset.db');

// Delete existing DB and WAL files to start fresh locally
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');

console.log('Deleted existing database to recreate...');

const db = new Database(DB_PATH);
// Use WAL mode for faster ingestion
db.pragma('journal_mode = WAL');

// Read all directories
const tables = fs.readdirSync(DATASET_DIR).filter(f => fs.statSync(path.join(DATASET_DIR, f)).isDirectory());

console.log(`Found ${tables.length} tables to process.`);

// Process each directory as a table
tables.forEach(tableName => {
    const tableDir = path.join(DATASET_DIR, tableName);
    const files = fs.readdirSync(tableDir).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
    
    if (files.length === 0) {
        console.warn(`No JSON files found in ${tableName}, skipping...`);
        return;
    }

    // Read the first file to infer schema
    const firstFilePath = path.join(tableDir, files[0]);
    const firstFileContent = fs.readFileSync(firstFilePath, 'utf8');
    const firstLine = firstFileContent.split('\n')[0];
    
    let sampleObj;
    try {
        sampleObj = JSON.parse(firstLine);
    } catch (e) {
        console.error(`Error parsing first line of ${firstFilePath}:`, e.message);
        return;
    }

    // Prepare columns
    const columns = [];
    for (const key of Object.keys(sampleObj)) {
        columns.push(`"${key}" TEXT`); 
    }

    const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columns.join(',\n  ')}\n);`;
    db.exec(createTableSQL);
    console.log(`Created table ${tableName}`);

    // Prepare insertion
    const keys = Object.keys(sampleObj).map(k => `"${k}"`);
    const placeholders = Object.keys(sampleObj).map(() => '?');
    const insertSQL = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const insert = db.prepare(insertSQL);

    // Read all files and insert data
    let insertedCount = 0;
    
    const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(row);
    });

    files.forEach(file => {
        const filePath = path.join(tableDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
        
        const rows = lines.map(line => {
            try {
                const obj = JSON.parse(line);
                return Object.keys(sampleObj).map(key => {
                    const val = obj[key];
                    if (val === null || val === undefined) return null;
                    if (typeof val === 'object') return JSON.stringify(val);
                    return String(val);
                });
            } catch (e) {
                return null;
            }
        }).filter(r => r !== null);

        insertMany(rows);
        insertedCount += rows.length;
    });

    console.log(`Loaded ${insertedCount} rows into ${tableName}`);
});

console.log('Database ingestion complete! Checkpointing and closing...');

// Checkpoint the WAL file into the main DB so the DB is self-contained
db.pragma('wal_checkpoint(TRUNCATE)');

// TRITICAL FIX for Vercel: Switch back to DELETE mode so it doesn't try to create a .db-shm lock file in read-only /var/task mapping
db.pragma('journal_mode = DELETE');

db.close();
console.log('Database ready for use.');

