import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

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
        status: 'active'
      },
      {
        user_id: 'USER002',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+8801234567891',
        balance: 750.00,
        card_id: '123456789A',
        status: 'active'
      },
      {
        user_id: 'USER003',
        name: 'Ahmed Rahman',
        email: 'ahmed.rahman@example.com',
        phone: '+8801234567892',
        balance: 300.00,
        card_id: 'ABC123DEF4',
        status: 'active'
      },
      {
        user_id: 'USER004',
        name: 'Fatima Khan',
        email: 'fatima.khan@example.com',
        phone: '+8801234567893',
        balance: 600.00,
        card_id: '987654321B',
        status: 'active'
      },
      {
        user_id: 'USER005',
        name: 'Mohammad Ali',
        email: 'mohammad.ali@example.com',
        phone: '+8801234567894',
        balance: 450.00,
        card_id: 'DEF456GHI7',
        status: 'active'
      }
    ]

    for (const user of testUsers) {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('USER_PROFILE')
        .select('user_id')
        .eq('card_id', user.card_id)
        .single()

      if (existingUser) {
        console.log(`User with card ${user.card_id} already exists, skipping...`)
        continue
      }

      // Insert new user
      const { data, error } = await supabase
        .from('USER_PROFILE')
        .insert([user])

      if (error) {
        console.error(`Error adding user ${user.name}:`, error.message)
      } else {
        console.log(`✅ Added user: ${user.name} (Card: ${user.card_id})`)
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
