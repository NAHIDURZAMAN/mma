import dotenv from 'dotenv'
dotenv.config()

console.log('🔍 Database Connection Test')
console.log('=' * 40)

// Check if DATABASE_URL exists
const dbUrl = process.env.DATABASE_URL
console.log('📊 DATABASE_URL exists:', !!dbUrl)
console.log('📊 DATABASE_URL length:', dbUrl?.length || 0)

if (dbUrl) {
  // Parse the URL to check components
  try {
    const url = new URL(dbUrl)
    console.log('🔍 Connection details:')
    console.log('  - Protocol:', url.protocol)
    console.log('  - Username:', url.username)
    console.log('  - Password:', url.password ? '[HIDDEN]' : 'NOT SET')
    console.log('  - Host:', url.hostname)
    console.log('  - Port:', url.port)
    console.log('  - Database:', url.pathname.substring(1))
    
    // Try to connect
    console.log('\n🔌 Attempting to connect...')
    
    import('./db.js').then(async ({ default: sql }) => {
      try {
        const result = await sql`SELECT NOW() as current_time`
        console.log('✅ Connection successful!')
        console.log('⏰ Server time:', result[0].current_time)
        await sql.end()
      } catch (error) {
        console.error('❌ Connection failed:', error.message)
        console.error('🔍 Error code:', error.code)
      }
    }).catch(error => {
      console.error('❌ Import failed:', error.message)
    })
    
  } catch (error) {
    console.error('❌ Invalid URL format:', error.message)
  }
} else {
  console.log('❌ DATABASE_URL is not set in .env file')
}

console.log('\n💡 Tips:')
console.log('1. Make sure your Supabase project is active')
console.log('2. Check your database password is correct')
console.log('3. Verify the connection string format')
console.log('4. Try using the direct connection instead of pooler')
