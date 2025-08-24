// Try alternative connection methods for Supabase
import dotenv from 'dotenv'
dotenv.config()

// Method 1: Try with different SSL configurations
async function testWithSSLOptions() {
  console.log('🧪 Testing with different SSL configurations...')
  
  try {
    const postgres = (await import('postgres')).default
    
    // Test 1: Disable SSL verification
    console.log('Test 1: Trying with SSL disabled...')
    const sql1 = postgres('postgresql://postgres:smart_transport@db.ppmbboefesbeqshbsrnd.supabase.co:5432/postgres', {
      ssl: false,
      max: 1,
      connect_timeout: 10
    })
    
    try {
      const result1 = await sql1`SELECT NOW()`
      console.log('✅ SSL disabled works!')
      await sql1.end()
      return true
    } catch (error) {
      console.log('❌ SSL disabled failed:', error.message)
      await sql1.end().catch(() => {})
    }
    
    // Test 2: Different SSL mode
    console.log('Test 2: Trying with SSL required but no verification...')
    const sql2 = postgres('postgresql://postgres:smart_transport@db.ppmbboefesbeqshbsrnd.supabase.co:5432/postgres', {
      ssl: { rejectUnauthorized: false },
      max: 1,
      connect_timeout: 10
    })
    
    try {
      const result2 = await sql2`SELECT NOW()`
      console.log('✅ SSL with no verification works!')
      await sql2.end()
      return true
    } catch (error) {
      console.log('❌ SSL no verification failed:', error.message)
      await sql2.end().catch(() => {})
    }
    
    // Test 3: Default SSL
    console.log('Test 3: Trying with default SSL...')
    const sql3 = postgres('postgresql://postgres:smart_transport@db.ppmbboefesbeqshbsrnd.supabase.co:5432/postgres', {
      ssl: 'require',
      max: 1,
      connect_timeout: 10
    })
    
    try {
      const result3 = await sql3`SELECT NOW()`
      console.log('✅ Default SSL works!')
      await sql3.end()
      return true
    } catch (error) {
      console.log('❌ Default SSL failed:', error.message)
      await sql3.end().catch(() => {})
    }
    
  } catch (error) {
    console.error('Failed to import postgres:', error.message)
  }
  
  return false
}

// Method 2: Test with node-postgres directly
async function testWithNodePostgres() {
  console.log('\n🧪 Testing with node-postgres (pg)...')
  
  try {
    // This will test if we can use pg instead of postgres
    const { Client } = await import('pg')
    
    const client = new Client({
      connectionString: 'postgresql://postgres:smart_transport@db.ppmbboefesbeqshbsrnd.supabase.co:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      }
    })
    
    await client.connect()
    const result = await client.query('SELECT NOW()')
    console.log('✅ node-postgres works!')
    console.log('Server time:', result.rows[0].now)
    
    await client.end()
    return true
    
  } catch (error) {
    console.log('❌ node-postgres failed:', error.message)
    return false
  }
}

// Test direct fetch to Supabase REST API
async function testRestAPI() {
  console.log('\n🧪 Testing Supabase REST API...')
  
  try {
    const url = 'https://ppmbboefesbeqshbsrnd.supabase.co/rest/v1/user_profile?select=count'
    const response = await fetch(url, {
      headers: {
        'apikey': 'your-anon-key-would-go-here'
      }
    })
    
    if (response.ok) {
      console.log('✅ REST API endpoint is reachable!')
      return true
    } else {
      console.log('❌ REST API failed with status:', response.status)
      return false
    }
    
  } catch (error) {
    console.log('❌ REST API test failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🔍 Testing Alternative Supabase Connection Methods\n')
  
  let success = false
  
  success = await testWithSSLOptions()
  if (success) return
  
  success = await testWithNodePostgres()
  if (success) return
  
  success = await testRestAPI()
  
  if (!success) {
    console.log('\n❌ All connection methods failed.')
    console.log('\n💡 Recommendations:')
    console.log('1. Double-check your Supabase project is active')
    console.log('2. Verify the project reference: ppmbboefesbeqshbsrnd')
    console.log('3. Check if your password is correct: smart_transport')
    console.log('4. Try getting fresh credentials from Supabase dashboard')
    console.log('5. Use the Supabase REST API instead (more reliable)')
  }
}

main().catch(console.error)
