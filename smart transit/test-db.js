// Database setup and API test script
import sql from './db.js';
import { userQueries, travelQueries, rechargeQueries, busQueries } from './dbHelpers.js';

async function setupDatabase() {
  console.log('🚀 Starting database setup...');
  
  try {
    // Test basic connection
    console.log('📡 Testing database connection...');
    const connectionTest = await sql`SELECT NOW() as current_time, version() as version`;
    console.log('✅ Database connected successfully!');
    console.log('⏰ Current time:', connectionTest[0].current_time);
    console.log('🗄️  Database version:', connectionTest[0].version.split(' ')[0]);

    // Check if tables exist
    console.log('\n📋 Checking existing tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const existingTables = tables.map(t => t.table_name);
    console.log('📋 Existing tables:', existingTables);
    
    const requiredTables = ['user_profile', 'bus_info', 'current_travel', 'travel_history', 'recharge_history'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables);
      console.log('🔧 Please run the SQL setup in Supabase dashboard first!');
      return false;
    }
    
    console.log('✅ All required tables exist!');
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testAPIFunctions() {
  console.log('\n🧪 Testing API functions...');
  
  try {
    // Test user queries
    console.log('\n👤 Testing user operations...');
    
    // Get all users
    const users = await sql`SELECT user_id, name, email, balance FROM user_profile LIMIT 5`;
    console.log('📊 Sample users:', users);
    
    if (users.length > 0) {
      const testUserId = users[0].user_id;
      
      // Test get user by email
      const userByEmail = await userQueries.getUserByEmail(users[0].email);
      console.log('✅ Get user by email:', userByEmail ? 'Success' : 'Failed');
      
      // Test travel history
      const travelHistory = await travelQueries.getTravelHistory(testUserId, 5);
      console.log('✅ Get travel history:', travelHistory.length, 'records');
      
      // Test recharge history  
      const rechargeHistory = await rechargeQueries.getRechargeHistory(testUserId, 5);
      console.log('✅ Get recharge history:', rechargeHistory.length, 'records');
    }
    
    // Test bus operations
    console.log('\n🚌 Testing bus operations...');
    const buses = await busQueries.getAllBuses();
    console.log('✅ Get all buses:', buses.length, 'buses found');
    console.log('📊 Buses:', buses);
    
    console.log('\n✅ All API functions tested successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

async function createSampleData() {
  console.log('\n🎲 Creating additional sample data...');
  
  try {
    // Add a sample recharge record
    const users = await sql`SELECT user_id FROM user_profile LIMIT 1`;
    if (users.length > 0) {
      const userId = users[0].user_id;
      
      // Add recharge record
      await rechargeQueries.addRecharge({
        userId: userId,
        amount: 100,
        paymentMethod: 'BKASH'
      });
      console.log('✅ Sample recharge record created');
      
      // Add travel history record
      await travelQueries.addToHistory({
        userId: userId,
        pickPoint: 'Dhanmondi 27',
        dropPoint: 'Gulshan 1',
        totalCost: 25,
        remainingBalance: 475
      });
      console.log('✅ Sample travel history record created');
    }
    
  } catch (error) {
    console.error('⚠️  Sample data creation failed (may already exist):', error.message);
  }
}

async function main() {
  console.log('🚀 Smart Transit Database Setup & API Test\n');
  
  const dbSetup = await setupDatabase();
  if (!dbSetup) {
    console.log('\n❌ Database setup failed. Please check your connection and run the SQL setup first.');
    process.exit(1);
  }
  
  const apiTest = await testAPIFunctions();
  if (!apiTest) {
    console.log('\n❌ API tests failed.');
    process.exit(1);
  }
  
  await createSampleData();
  
  console.log('\n🎉 Database setup and API testing completed successfully!');
  console.log('🔗 Your application should now be ready to use the database.');
  
  // Close the database connection
  await sql.end();
}

// Run the setup
main().catch(console.error);
