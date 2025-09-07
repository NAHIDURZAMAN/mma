// Test Supabase connection and create sample users
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', SUPABASE_URL)
console.log('Key:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'Not set')

async function testSupabase() {
  try {
    // Test basic connection
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profile?select=count&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Connection failed:', response.status, errorText)
      return false
    }

    console.log('✅ Connection successful!')
    
    // Try to get users
    const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profile?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (usersResponse.ok) {
      const users = await usersResponse.json()
      console.log(`📊 Found ${users.length} users in database`)
      
      if (users.length === 0) {
        console.log('📝 Creating sample users...')
        await createSampleUsers()
      } else {
        console.log('👥 Sample users:')
        users.slice(0, 3).forEach(user => {
          console.log(`  - ${user.name} (${user.card_id}) - Balance: ৳${user.balance}`)
        })
      }
    }

    return true
  } catch (error) {
    console.error('❌ Error:', error.message)
    return false
  }
}

async function createSampleUsers() {
  const sampleUsers = [
    {
      name: "আহমেদ রহমান",
      email: "ahmed@example.com", 
      phone: "01712345678",
      card_id: "1234567890",
      balance: 150.50,
      dob: "1990-01-15",
      password: "password123",
      address: "ঢাকা, বাংলাদেশ"
    },
    {
      name: "ফাতেমা খাতুন",
      email: "fatema@example.com",
      phone: "01812345678", 
      card_id: "2345678901",
      balance: 225.75,
      dob: "1992-05-20",
      password: "password123",
      address: "চট্টগ্রাম, বাংলাদেশ"
    },
    {
      name: "মোহাম্মদ আলী",
      email: "ali@example.com",
      phone: "01912345678",
      card_id: "3456789012", 
      balance: 89.25,
      dob: "1988-11-30",
      password: "password123",
      address: "সিলেট, বাংলাদেশ"
    }
  ]

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profile`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(sampleUsers)
    })

    if (response.ok) {
      const created = await response.json()
      console.log(`✅ Created ${created.length} sample users`)
    } else {
      const error = await response.text()
      console.error('❌ Failed to create users:', error)
    }
  } catch (error) {
    console.error('❌ Error creating users:', error.message)
  }
}

testSupabase()
