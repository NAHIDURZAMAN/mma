# Migration Guide: Oracle to Supabase (PostgreSQL)

## Setup Steps

### 1. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned
3. Go to Settings → Database and copy your connection string
4. Create a `.env` file in your project root with:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres
   PORT=2000
   SESSION_SECRET=your_session_secret_here
   ```

### 2. Database Schema Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `DB/supabase_complete_setup.sql`
4. Click "RUN" to execute all the SQL commands
5. This will create all tables, indexes, and sample data

### 3. Code Changes Required

#### Replace OracleDB imports with PostgreSQL

**Old (Oracle):**

```javascript
const OracleDB = require("oracledb");
const dbConfig = require("./Routes/dbConfig.js");
```

**New (PostgreSQL/Supabase):**

```javascript
import sql from "./db.js";
// or for CommonJS:
// const sql = require('./db.js');
```

#### Update Database Queries

**Old Oracle syntax:**

```javascript
const connection = await OracleDB.getConnection(dbConfig);
const result = await connection.execute(
  "SELECT * FROM USER_PROFILE WHERE USER_ID = :id",
  [userId]
);
await connection.close();
```

**New PostgreSQL syntax:**

```javascript
const result = await sql`
  SELECT * FROM USER_PROFILE WHERE USER_ID = ${userId}
`;
```

### 4. Key Differences Between Oracle and PostgreSQL

| Feature        | Oracle                    | PostgreSQL                          |
| -------------- | ------------------------- | ----------------------------------- |
| Data Types     | `VARCHAR2(100)`           | `VARCHAR(100)`                      |
| Numbers        | `NUMBER(10,2)`            | `DECIMAL(10,2)` or `NUMERIC(10,2)`  |
| Auto-increment | `SEQUENCE` + `TRIGGER`    | `SERIAL` or `GENERATED`             |
| Date/Time      | `SYSDATE`, `SYSTIMESTAMP` | `CURRENT_DATE`, `CURRENT_TIMESTAMP` |
| String Concat  | `\|\|`                    | `\|\|` (same)                       |
| Unique IDs     | Custom sequences          | `gen_random_uuid()` or sequences    |

### 5. Updated Schema Features

#### New Features Added:

- **Automatic timestamps**: `created_at` and `updated_at` columns
- **Better constraints**: CHECK constraints for status fields
- **Improved indexes**: Better performance with targeted indexes
- **UUID support**: For unique identifiers where needed
- **Computed columns**: Age calculation happens automatically
- **Cascading deletes**: Better referential integrity

#### Changes Made:

- `VARCHAR2` → `VARCHAR` or `TEXT`
- `NUMBER` → `DECIMAL` or `INTEGER`
- Oracle sequences → PostgreSQL sequences with better defaults
- Oracle triggers → PostgreSQL functions and triggers
- Better error handling and constraints

### 6. Using the New Database Helpers

Instead of writing raw SQL everywhere, use the helper functions:

```javascript
import { userQueries, travelQueries } from "./dbHelpers.js";

// Create user
const newUser = await userQueries.createUser({
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  cardId: "CARD123",
  balance: 100,
  dob: "1990-01-01",
  address: "123 Street",
  password: "hashed_password",
});

// Get user by email
const user = await userQueries.getUserByEmail("john@example.com");

// Create travel
const travel = await travelQueries.createCurrentTravel({
  userId: "U000001",
  pickPoint: "Point A",
  dropPoint: "Point B",
  perKmCost: 5,
  totalCost: 25,
});
```

### 7. Environment Variables

Make sure your `.env` file contains:

```
DATABASE_URL=your_supabase_connection_string
PORT=2000
NODE_ENV=development
SESSION_SECRET=your_secret_key
```

### 8. Package.json Updates

Your dependencies now include:

- `postgres` - PostgreSQL client for Node.js
- All existing dependencies remain the same

### 9. Testing the Migration

1. Run your SQL setup in Supabase
2. Update your `.env` with the correct DATABASE_URL
3. Test the connection:

   ```javascript
   import sql from "./db.js";

   // Test query
   const result = await sql`SELECT NOW()`;
   console.log("Database connected:", result[0]);
   ```

### 10. Production Considerations

- **Connection Pooling**: The `postgres` library handles this automatically
- **SSL**: Supabase connections use SSL by default
- **Error Handling**: Implement proper try-catch blocks
- **Performance**: Use the provided indexes, add more if needed
- **Backup**: Supabase provides automatic backups
- **Monitoring**: Use Supabase dashboard for monitoring

## Files Created/Modified:

- ✅ `db.js` - New PostgreSQL connection
- ✅ `dbHelpers.js` - Database query helpers
- ✅ `DB/supabase_complete_setup.sql` - Complete schema setup
- ✅ `DB/supabase_*.sql` - Individual table setups
- ✅ `.env.example` - Environment template
- ✅ `Routes/dbConfig.js` - Updated (marked as deprecated)

## Next Steps:

1. Set up your Supabase project
2. Run the SQL setup script
3. Configure your `.env` file
4. Update your application routes to use the new database helpers
5. Test thoroughly before deploying
