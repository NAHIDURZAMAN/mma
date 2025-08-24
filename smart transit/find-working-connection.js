// Test multiple Supabase connection formats
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

// Different possible formats for your project
const formats = [
  // Format 1: Direct connection
  'postgresql://postgres:smart_transport@db.ppmbboefesbeqshbsrnd.supabase.co:5432/postgres',
  
  // Format 2: Pooler with postgres. prefix
  'postgresql://postgres.ppmbboefesbeqshbsrnd:smart_transport@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  
  // Format 3: Pooler port 6543
  'postgresql://postgres.ppmbboefesbeqshbsrnd:smart_transport@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  
  // Format 4: Your current format from .env
  process.env.DATABASE_URL
]

async function testFormat(connectionString, index) {
  if (!connectionString) return false
  
  console.log(`\n🧪 Format ${index + 1}: ${connectionString.substring(0, 60)}...`)
  
  try {
    const sql = postgres(connectionString, {
      ssl: 'require',
      max: 1,
      connect_timeout: 10
    })
    
    const result = await sql`SELECT NOW() as time`
    console.log('✅ SUCCESS! Server time:', result[0].time)
    
    await sql.end()
    return connectionString
    
  } catch (error) {
    console.log('❌ Failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Testing Multiple Supabase Connection Formats\n')
  
  for (let i = 0; i < formats.length; i++) {
    const working = await testFormat(formats[i], i)
    if (working) {
      console.log(`\n🎉 WORKING CONNECTION FOUND!`)
      console.log(`Use this in your .env file:`)
      console.log(`DATABASE_URL=${working}`)
      break
    }
  }
  
  console.log('\n📝 If none work, please:')
  console.log('1. Check your Supabase dashboard for the exact connection string')
  console.log('2. Verify your project is not paused')
  console.log('3. Double-check your database password')
}

main().catch(console.error)
