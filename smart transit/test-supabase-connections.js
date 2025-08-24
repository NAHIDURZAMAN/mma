// Test multiple connection formats for Supabase
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const projectRef = 'ppmbboefesbeqshbsrnd'
const password = 'smart_transport'

// Different connection string formats to try
const connectionStrings = [
  // Direct connection (port 5432)
  `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  
  // Session pooler (port 6543) - Transaction mode
  `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  
  // Direct connection to main database server
  `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  
  // Your current format (for comparison)
  process.env.DATABASE_URL,
]

async function testConnection(connectionString, index) {
  console.log(`\n🧪 Test ${index + 1}: Testing connection...`)
  console.log('🔗 Connection string format:', connectionString?.substring(0, 50) + '...')
  
  try {
    const sql = postgres(connectionString, {
      ssl: 'require',
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    })
    
    const result = await sql`SELECT NOW() as current_time, version() as version`
    console.log('✅ Connection successful!')
    console.log('⏰ Server time:', result[0].current_time)
    console.log('🗄️  Database version:', result[0].version.split(' ')[0])
    
    await sql.end()
    return true
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message)
    console.log('🔍 Error code:', error.code || 'Unknown')
    return false
  }
}

async function main() {
  console.log('🚀 Supabase Connection Test Suite')
  console.log('=' * 50)
  
  let successCount = 0
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const connectionString = connectionStrings[i]
    if (connectionString) {
      const success = await testConnection(connectionString, i)
      if (success) {
        successCount++
        console.log(`\n🎉 SUCCESS! Use this connection string in your .env:`)
        console.log(`DATABASE_URL=${connectionString}`)
        break // Stop at first successful connection
      }
    }
  }
  
  if (successCount === 0) {
    console.log('\n❌ All connection tests failed!')
    console.log('\n🔧 Troubleshooting steps:')
    console.log('1. Check your Supabase project is not paused')
    console.log('2. Verify your database password in Supabase Settings → Database')
    console.log('3. Make sure your project reference is correct')
    console.log('4. Try resetting your database password')
    console.log('5. Check if your IP is allowed (though Supabase usually allows all)')
  }
}

main().catch(console.error)
