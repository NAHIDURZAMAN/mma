// Script to add the specific RFID card that was scanned
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

// Helper function to make Supabase REST API calls
async function supabaseRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase API error: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  return await response.json()
}

async function addTestCard() {
  console.log('🔄 Adding test RFID card 520028A3A0 to database...\n')
  
  try {
    // First, check if the card already exists
    const existingCard = await supabaseRequest('user_profile?card_id=eq.520028A3A0&select=*')
    
    if (existingCard.length > 0) {
      console.log('✅ Card 520028A3A0 already exists in database')
      console.log('User:', existingCard[0])
      return
    }
    
    // Get the next user ID
    const existingUsers = await supabaseRequest('user_profile?select=user_id&order=user_id.desc&limit=1')
    const nextUserId = existingUsers.length > 0 ? existingUsers[0].user_id + 1 : 1
    
    // Add the new user with the scanned card
    const newUser = {
      user_id: nextUserId,
      card_id: '520028A3A0',
      name: 'Test User',
      email: 'testuser@example.com',
      phone: '+8801234567890',
      age: 25,
      balance: 100, // Starting balance of 100 BDT
      created_at: new Date().toISOString()
    }
    
    const result = await supabaseRequest('user_profile', {
      method: 'POST',
      body: JSON.stringify(newUser)
    })
    
    console.log('✅ Successfully added test card:')
    console.log(`   Card ID: ${newUser.card_id}`)
    console.log(`   Name: ${newUser.name}`)
    console.log(`   Email: ${newUser.email}`)
    console.log(`   Balance: ${newUser.balance} BDT`)
    console.log(`   User ID: ${newUser.user_id}`)
    
  } catch (error) {
    console.error('❌ Error adding test card:', error.message)
  }
}

// Run the script
addTestCard()
