const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const isVercel = process.env.VERCEL === "1";

// Vercel bundles files differently, so we must use process.cwd() to reach 'backend/dataset.db'
const DB_PATH_CWD = path.join(process.cwd(), 'backend', 'dataset.db');
const DB_PATH_DIRNAME = path.join(__dirname, 'dataset.db');

let db;
try {
    if (isVercel) {
        console.log('Detected Vercel. Opening database in readonly mode...');
        try {
            console.log(`Trying path: ${DB_PATH_CWD}`);
            db = new Database(DB_PATH_CWD, { readonly: true });
        } catch (e) {
            console.log(`Failed with process.cwd(). Trying path: ${DB_PATH_DIRNAME}`);
            db = new Database(DB_PATH_DIRNAME, { readonly: true });
        }
    } else {
        console.log('Opening database locally in readonly mode...');
        db = new Database(DB_PATH_DIRNAME, { readonly: true });
    }
} catch (error) {
    console.error('Error opening database:', error);
    throw error;
}

// Export the db for other scripts to use
module.exports = db;
