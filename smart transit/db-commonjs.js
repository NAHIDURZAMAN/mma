const postgres = require('postgres');
require('dotenv').config();

// Remove quotes if they exist and get the connection string
const connectionString = process.env.DATABASE_URL?.replace(/"/g, '');

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env file');
}

console.log('🔗 Connecting to database...');
const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

module.exports = sql;