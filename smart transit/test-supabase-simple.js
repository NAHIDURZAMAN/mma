// Simple connection test for Supabase
import dotenv from 'dotenv'
dotenv.config()

console.log('🔍 Supabase Connection Test')
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set')

if (process.env.DATABASE_URL) {
  try {
    // Try to import and test the connection
    const { default: sql } = await import('./db.js')
    
    console.log('📡 Testing connection...')
    const result = await sql`SELECT NOW() as server_time, version() as db_version`
    
    console.log('✅ Connection successful!')
    console.log('Server time:', result[0].server_time)
    console.log('Database version:', result[0].db_version.split(' ')[0])
    
    // Test a simple query
    const testQuery = await sql`SELECT 1 as test_number`
    console.log('Test query result:', testQuery[0].test_number)
    
    await sql.end()
    console.log('🎉 Database is ready for table creation!')
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('Error code:', error.code)
    
    // Provide troubleshooting suggestions
    console.log('\n🔧 Troubleshooting suggestions:')
    console.log('1. Check if your Supabase project is active (not paused)')
    console.log('2. Verify your database password is correct')
    console.log('3. Try getting a fresh connection string from Supabase dashboard')
    console.log('4. Make sure you\'re using the correct project reference')
  }
} else {
  console.log('❌ DATABASE_URL not found in .env file')
}
