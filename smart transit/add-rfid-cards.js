// Script to add real RFID card IDs to the database
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

// Real RFID card IDs from Arduino scanner with Bengali names (in English)
const rfidCards = [
  { card_id: '520028E289', name: 'Abdul Rahman', email: 'abdul.rahman@gmail.com' },
  { card_id: '520028F91B', name: 'Fatema Khatun', email: 'fatema.khatun@gmail.com' },
  { card_id: '52002925B2', name: 'Mohammad Karim', email: 'mohammad.karim@yahoo.com' },
  { card_id: '4400309616', name: 'Rashida Begum', email: 'rashida.begum@gmail.com' },
  { card_id: '4400306E65', name: 'Hasan Ali', email: 'hasan.ali@outlook.com' },
  { card_id: '4400305056', name: 'Sumaiya Akter', email: 'sumaiya.akter@gmail.com' },
  { card_id: '440030755A', name: 'Nazrul Islam', email: 'nazrul.islam@gmail.com' },
  { card_id: '520026D872', name: 'Nadia Sultana', email: 'nadia.sultana@gmail.com' },
  { card_id: '520028B840', name: 'Tanvir Hossen', email: 'tanvir.hossen@gmail.com' }
]

async function insertRFIDCards() {
  console.log('🔄 Adding real RFID cards to database...\n')
  
  try {
    // First, let's get the current max user_id
    const existingUsers = await supabaseRequest('user_profile?select=user_id&order=user_id.desc&limit=1')
    let nextUserId = existingUsers.length > 0 ? existingUsers[0].user_id + 1 : 1
    
    for (const cardData of rfidCards) {
      try {
        // Check if card already exists
        const existingCard = await supabaseRequest(`user_profile?card_id=eq.${cardData.card_id}&select=user_id,name`)
        
        if (existingCard.length > 0) {
          console.log(`⚠️  Card ${cardData.card_id} already exists for user: ${existingCard[0].name}`)
          continue
        }
        
        // Insert new user with RFID card
        const userData = {
          user_id: nextUserId,
          name: cardData.name,
          email: cardData.email,
          phone: `+880171234${String(nextUserId).padStart(4, '0')}`,
          password: 'password123', // Default password
          card_id: cardData.card_id,
          balance: 100.00, // Starting balance
          dob: '1990-01-01', // Default date of birth
          address: 'Dhaka, Bangladesh', // Default address
          created_at: new Date().toISOString()
        }
        
        const result = await supabaseRequest('user_profile', {
          method: 'POST',
          body: JSON.stringify(userData)
        })
        
        console.log(`✅ Added user: ${cardData.name} with card ID: ${cardData.card_id}`)
        nextUserId++
        
      } catch (error) {
        console.error(`❌ Error adding card ${cardData.card_id}:`, error.message)
      }
    }
    
    console.log('\n🎉 RFID card insertion completed!')
    console.log('\n📋 Summary of added cards:')
    rfidCards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.card_id} - ${card.name}`)
    })
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message)
  }
}

// Run the script
insertRFIDCards().catch(console.error)
