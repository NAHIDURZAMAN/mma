// PostgreSQL/Supabase Database Configuration
// This file is now replaced by db.js and .env file
// Import sql from '../db.js' instead of using this config

// Legacy Oracle DB configuration (deprecated)
// export default {
//   user: 'SYSTEM',
//   password: '12688',
//   connectString: 'localhost:1521/ORCLCDB',
// };

// For PostgreSQL/Supabase, use the db.js file with DATABASE_URL from .env
module.exports = {
  // This config is deprecated - use sql from db.js instead
  deprecated: true,
  message: "Use require('../db.js') for PostgreSQL/Supabase connection"
};
