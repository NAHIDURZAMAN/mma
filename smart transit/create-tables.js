// Database table creation script
import sql from './db.js';

async function createTables() {
  console.log('🚀 Creating database tables...');
  
  try {
    // Enable UUID extension
    console.log('📦 Enabling UUID extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    // Drop existing tables in correct order (reverse dependency)
    console.log('🗑️  Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS current_travel CASCADE`;
    await sql`DROP TABLE IF EXISTS travel_history CASCADE`;
    await sql`DROP TABLE IF EXISTS recharge_history CASCADE`;
    await sql`DROP TABLE IF EXISTS bus_info CASCADE`;
    await sql`DROP TABLE IF EXISTS user_profile CASCADE`;
    await sql`DROP SEQUENCE IF EXISTS user_id_seq CASCADE`;
    
    // Create sequence
    console.log('🔢 Creating user ID sequence...');
    await sql`CREATE SEQUENCE user_id_seq START 1`;
    
    // Create update function
    console.log('⚡ Creating update function...');
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;
    
    // 1. Create USER_PROFILE table
    console.log('👤 Creating USER_PROFILE table...');
    await sql`
      CREATE TABLE user_profile (
          user_id VARCHAR(20) PRIMARY KEY DEFAULT ('U' || LPAD(nextval('user_id_seq')::TEXT, 6, '0')),
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(20),
          card_id VARCHAR(50) UNIQUE NOT NULL,
          balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          dob TIMESTAMP NOT NULL,
          password VARCHAR(100) NOT NULL,
          age INTEGER GENERATED ALWAYS AS (
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob::DATE))
          ) STORED,
          address VARCHAR(200) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create trigger for user_profile
    await sql`
      CREATE TRIGGER update_user_profile_updated_at 
          BEFORE UPDATE ON user_profile
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `;
    
    // 2. Create BUS_INFO table
    console.log('🚌 Creating BUS_INFO table...');
    await sql`
      CREATE TABLE bus_info (
          bus_id VARCHAR(100) PRIMARY KEY,
          total_seats INTEGER DEFAULT 50,
          available_seats INTEGER DEFAULT 50,
          per_km_cost DECIMAL(10, 2) DEFAULT 5.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TRIGGER update_bus_info_updated_at 
          BEFORE UPDATE ON bus_info
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `;
    
    // 3. Create CURRENT_TRAVEL table
    console.log('🛣️  Creating CURRENT_TRAVEL table...');
    await sql`
      CREATE TABLE current_travel (
          travel_id VARCHAR(400) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id VARCHAR(100) REFERENCES user_profile(user_id) ON DELETE CASCADE,
          pick_point TEXT NOT NULL,
          drop_point TEXT,
          per_km_cost DECIMAL(10, 2) DEFAULT 5.00,
          total_cost DECIMAL(10, 2),
          current_longitude VARCHAR(100),
          current_latitude VARCHAR(100),
          dropoff_longitude VARCHAR(100),
          dropoff_latitude VARCHAR(100),
          travel_date DATE DEFAULT CURRENT_DATE,
          travel_status VARCHAR(20) DEFAULT 'ONGOING' CHECK (travel_status IN ('ONGOING', 'COMPLETED', 'CANCELLED')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TRIGGER update_current_travel_updated_at 
          BEFORE UPDATE ON current_travel
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `;
    
    // 4. Create TRAVEL_HISTORY table
    console.log('📚 Creating TRAVEL_HISTORY table...');
    await sql`
      CREATE TABLE travel_history (
          history_id VARCHAR(400) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id VARCHAR(400) REFERENCES user_profile(user_id) ON DELETE CASCADE,
          travel_date DATE DEFAULT CURRENT_DATE,
          travel_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          pick_point TEXT,
          drop_point TEXT,
          total_cost DECIMAL(10, 2),
          remaining_balance DECIMAL(10, 2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 5. Create RECHARGE_HISTORY table
    console.log('💳 Creating RECHARGE_HISTORY table...');
    await sql`
      CREATE TABLE recharge_history (
          recharge_id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id VARCHAR(100) REFERENCES user_profile(user_id) ON DELETE CASCADE,
          recharge_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          recharge_amount DECIMAL(10, 2) NOT NULL,
          payment_method VARCHAR(50) CHECK (payment_method IN ('CARD', 'BKASH', 'NAGAD', 'ROCKET', 'UPAY')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create indexes
    console.log('📊 Creating indexes...');
    await sql`CREATE INDEX idx_current_travel_user_id ON current_travel(user_id)`;
    await sql`CREATE INDEX idx_current_travel_status ON current_travel(travel_status)`;
    await sql`CREATE INDEX idx_travel_history_user_id ON travel_history(user_id)`;
    await sql`CREATE INDEX idx_travel_history_travel_date ON travel_history(travel_date)`;
    await sql`CREATE INDEX idx_travel_history_travel_time ON travel_history(travel_time)`;
    await sql`CREATE INDEX idx_recharge_history_user_id ON recharge_history(user_id)`;
    await sql`CREATE INDEX idx_recharge_history_date ON recharge_history(recharge_date)`;
    await sql`CREATE INDEX idx_recharge_history_payment_method ON recharge_history(payment_method)`;
    
    // Insert sample data
    console.log('📝 Inserting sample data...');
    
    // Sample users
    await sql`
      INSERT INTO user_profile (name, email, phone, card_id, balance, dob, address, password)
      VALUES 
          ('John Doe', 'john.doe@example.com', '+123456789', '520028A3A0', 500, '1996-04-12 10:00:00', '123 Street, City, Country', 'hashed_password'),
          ('Jane Smith', 'jane.smith@example.com', '+987654321', '520028B840', 1000, '1992-05-15 09:30:00', '456 Avenue, Town, Country', 'hashed_password'),
          ('Mike Johnson', 'mike.johnson@example.com', '+1122334450', '520026D872', 750, '1998-02-22 08:15:00', '789 Boulevard, City, Country', 'hashed_password'),
          ('Chris Johnson', 'chris.johnson@example.com', '+1122334460', '520028E289', 750, '1995-01-10 08:30:00', '789 Boulevard, City, Country', 'hashed_password'),
          ('Alex Johnson', 'alex.johnson@example.com', '+1122334470', '4400309616', 750, '1997-03-05 10:15:00', '789 Boulevard, City, Country', 'hashed_password')
    `;
    
    // Sample buses
    await sql`
      INSERT INTO bus_info (bus_id) VALUES ('B1'), ('B2')
    `;
    
    console.log('✅ All tables created successfully!');
    
    // Verify tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('📋 Created tables:', tables.map(t => t.table_name));
    
    return true;
    
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Smart Transit - Database Table Creation\n');
  
  const success = await createTables();
  
  if (success) {
    console.log('\n🎉 Database setup completed successfully!');
    console.log('🔗 You can now run your application.');
  } else {
    console.log('\n❌ Database setup failed.');
  }
  
  // Close the database connection
  await sql.end();
}

// Run the setup
main().catch(console.error);
