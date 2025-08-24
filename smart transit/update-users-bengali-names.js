// Script to update existing users with Bengali names (in English) and emails
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

// Bengali names in English and corresponding emails mapped to card IDs
const userUpdates = [
  { card_id: '520028A3A0', name: 'Abdul Rahman', email: 'abdul.rahman@gmail.com' },
  { card_id: '520028B840', name: 'Fatema Khatun', email: 'fatema.khatun@gmail.com' },
  { card_id: '520026D872', name: 'Mohammad Karim', email: 'mohammad.karim@yahoo.com' },
  { card_id: '520028E289', name: 'Rashida Begum', email: 'rashida.begum@gmail.com' },
  { card_id: '520028F91B', name: 'Hasan Ali', email: 'hasan.ali@outlook.com' },
  { card_id: '52002925B2', name: 'Sumaiya Akter', email: 'sumaiya.akter@gmail.com' },
  { card_id: '4400309616', name: 'Nazrul Islam', email: 'nazrul.islam@gmail.com' },
  { card_id: '4400306E65', name: 'Nadia Sultana', email: 'nadia.sultana@gmail.com' },
  { card_id: '4400305056', name: 'Tanvir Hossen', email: 'tanvir.hossen@gmail.com' },
  { card_id: '440030755A', name: 'Shahida Akter', email: 'shahida.akter@gmail.com' }
]

async function updateUsersBengaliNames() {
  console.log('🔄 Updating users with Bengali names (English) and emails...\n')
  
  try {
    // Get all current users
    const currentUsers = await supabaseRequest('user_profile?select=user_id,name,email,card_id&order=user_id')
    console.log(`📋 Found ${currentUsers.length} existing users in database\n`)
    
    let updatedCount = 0
    
    for (const user of currentUsers) {
      try {
        // Find the update data for this user's card_id
        const updateData = userUpdates.find(update => update.card_id === user.card_id)
        
        if (updateData) {
          // Update the user with Bengali name and email
          const result = await supabaseRequest(`user_profile?user_id=eq.${user.user_id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: updateData.name,
              email: updateData.email
            })
          })
          
          console.log(`✅ Updated User ID ${user.user_id}: ${user.name} → ${updateData.name}`)
          console.log(`   Email: ${user.email} → ${updateData.email}`)
          console.log(`   Card ID: ${user.card_id}\n`)
          updatedCount++
          
        } else {
          console.log(`⚠️  No update data found for User ID ${user.user_id} (Card: ${user.card_id})`)
        }
        
      } catch (error) {
        console.error(`❌ Error updating user ${user.user_id}:`, error.message)
      }
    }
    
    console.log(`\n🎉 Update completed!`)
    console.log(`📊 Updated ${updatedCount} users with Bengali names and emails\n`)
    
    // Show final summary
    console.log('📋 Summary of Bengali names:')
    userUpdates.forEach((update, index) => {
      console.log(`${index + 1}. ${update.card_id} - ${update.name} (${update.email})`)
    })
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message)
  }
}

// Run the script
updateUsersBengaliNames().catch(console.error)
