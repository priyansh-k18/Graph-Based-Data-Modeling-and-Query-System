const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Use __dirname to reliably find dataset.db in the same directory as db.js
const DB_PATH = path.join(__dirname, 'dataset.db');

const isVercel = process.env.VERCEL === "1";
let db;

try {
    if (isVercel) {
        console.log('Detected Vercel. Opening database in readonly mode...');
    } else {
        console.log('Opening database locally in readonly mode...');
    }
    db = new Database(DB_PATH, { readonly: true });
} catch (error) {
    console.error('Error opening database:', error);
    throw error;
}

// Export the db for other scripts to use
module.exports = db;
