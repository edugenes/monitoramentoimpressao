const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('../src/config/db');

function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`Executando migracao: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    console.log(`Migracao ${file} executada com sucesso`);
  }

  console.log('Todas as migracoes foram executadas');
  db.close();
}

runMigrations();
