import dotenv from 'dotenv'

dotenv.config()

// Supabase request function (copied from main app)
async function supabaseRequest(endpoint, options = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${endpoint}`
  
  const config = {
    method: options.method || 'GET',
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }
  
  if (options.method === 'POST' || options.method === 'PATCH') {
    config.body = JSON.stringify(options.body)
  }
  
  const response = await fetch(url, config)
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Supabase request failed: ${response.status} ${error}`)
  }
  
  return response.json()
}

async function addTestUsers() {
  try {
    console.log('Adding test users to the database...')

    const testUsers = [
      {
        user_id: 'USER001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+8801234567890',
        balance: 500.00,
        card_id: '520028A3A0', // The card that was scanned
        status: 'active',
        password: 'password123'
      },
      {
        user_id: 'USER002',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+8801234567891',
        balance: 750.00,
        card_id: '123456789A',
        status: 'active',
        password: 'password123'
      },
      {
        user_id: 'USER003',
        name: 'Ahmed Rahman',
        email: 'ahmed.rahman@example.com',
        phone: '+8801234567892',
        balance: 300.00,
        card_id: 'ABC123DEF4',
        status: 'active',
        password: 'password123'
      },
      {
        user_id: 'USER004',
        name: 'Fatima Khan',
        email: 'fatima.khan@example.com',
        phone: '+8801234567893',
        balance: 600.00,
        card_id: '987654321B',
        status: 'active',
        password: 'password123'
      },
      {
        user_id: 'USER005',
        name: 'Mohammad Ali',
        email: 'mohammad.ali@example.com',
        phone: '+8801234567894',
        balance: 450.00,
        card_id: 'DEF456GHI7',
        status: 'active',
        password: 'password123'
      }
    ]

    for (const user of testUsers) {
      try {
        // Check if user already exists
        const existingUsers = await supabaseRequest(`user_profile?card_id=eq.${user.card_id}&select=user_id`)
        
        if (existingUsers && existingUsers.length > 0) {
          console.log(`User with card ${user.card_id} already exists, skipping...`)
          continue
        }

        // Insert new user
        await supabaseRequest('user_profile', {
          method: 'POST',
          body: user
        })

        console.log(`✅ Added user: ${user.name} (Card: ${user.card_id})`)
        
      } catch (error) {
        console.error(`Error adding user ${user.name}:`, error.message)
      }
    }

    console.log('\n🎉 Test users setup complete!')
    console.log('\nYou can now use these RFID cards:')
    testUsers.forEach(user => {
      console.log(`- ${user.card_id} (${user.name}) - Balance: ৳${user.balance}`)
    })

  } catch (error) {
    console.error('Error setting up test users:', error)
  }
}

// Run the function
addTestUsers()
