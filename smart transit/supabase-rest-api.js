// Smart Transit API using Supabase REST API
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 2000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Supabase configuration (you'll need to add these to your .env)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ppmbboefesbeqshbsrnd.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here'

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
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }
  
  return await response.json()
}

// Test Supabase connection
let supabaseConnected = false

async function testSupabaseConnection() {
  try {
    // Try to fetch one user to test connection
    const result = await supabaseRequest('user_profile?select=user_id&limit=1')
    console.log('✅ Supabase REST API connected successfully!')
    console.log('📊 Test query returned:', result.length, 'records')
    supabaseConnected = true
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message)
    console.log('⚠️  Please check your SUPABASE_URL and SUPABASE_ANON_KEY')
    supabaseConnected = false
  }
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  let dbStatus = supabaseConnected ? 'Connected via REST API' : 'Not connected'
  
  res.json({
    status: 'OK',
    message: 'Smart Transit API is running',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    connection_type: 'Supabase REST API'
  })
})

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const users = await supabaseRequest('user_profile?select=user_id,name,email,phone,card_id,balance,created_at&order=user_id')
    
    res.json({
      success: true,
      data: users,
      count: users.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const users = await supabaseRequest(`user_profile?select=user_id,name,email,phone,card_id,balance,created_at&user_id=eq.${req.params.id}`)
    
    if (users.length > 0) {
      res.json({ success: true, data: users[0] })
    } else {
      res.status(404).json({ success: false, message: 'User not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Create user
app.post('/api/users', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { name, email, phone, card_id, balance, dob, address, password = 'default_password' } = req.body
    
    // Validate required fields
    if (!name || !email || !card_id || !address) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, card_id, address'
      })
    }
    
    const userData = {
      name,
      email,
      phone,
      card_id,
      balance: balance || 0,
      dob,
      address,
      password
    }
    
    const newUser = await supabaseRequest('user_profile', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser[0]
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Update user balance
app.patch('/api/users/:id/balance', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { balance } = req.body
    
    if (balance === undefined || isNaN(parseFloat(balance))) {
      return res.status(400).json({ success: false, message: 'Invalid balance amount' })
    }
    
    const updatedUser = await supabaseRequest(`user_profile?user_id=eq.${req.params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: parseFloat(balance) })
    })
    
    if (updatedUser.length > 0) {
      res.json({
        success: true,
        message: 'Balance updated successfully',
        data: { user_id: updatedUser[0].user_id, balance: updatedUser[0].balance }
      })
    } else {
      res.status(404).json({ success: false, message: 'User not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get travel history
app.get('/api/users/:id/travels', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const travels = await supabaseRequest(`travel_history?user_id=eq.${req.params.id}&order=travel_time.desc&limit=10`)
    
    res.json({
      success: true,
      data: travels,
      count: travels.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get recharge history
app.get('/api/users/:id/recharges', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const recharges = await supabaseRequest(`recharge_history?user_id=eq.${req.params.id}&order=recharge_date.desc&limit=10`)
    
    res.json({
      success: true,
      data: recharges,
      count: recharges.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Create recharge
app.post('/api/recharge', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { user_id, amount, payment_method } = req.body
    
    if (!user_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, amount, payment_method'
      })
    }
    
    const rechargeData = {
      user_id: parseInt(user_id),
      recharge_amount: parseFloat(amount),
      payment_method
    }
    
    const recharge = await supabaseRequest('recharge_history', {
      method: 'POST',
      body: JSON.stringify(rechargeData)
    })
    
    res.status(201).json({
      success: true,
      message: 'Recharge created successfully',
      data: recharge[0]
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all buses
app.get('/api/buses', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const buses = await supabaseRequest('bus_info?order=bus_id')
    
    res.json({
      success: true,
      data: buses,
      count: buses.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Start travel
app.post('/api/travel/start', async (req, res) => {
  try {
    if (!supabaseConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { user_id, pick_point, current_longitude, current_latitude } = req.body
    
    if (!user_id || !pick_point) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, pick_point'
      })
    }
    
    const travelData = {
      user_id: parseInt(user_id),
      pick_point,
      current_longitude,
      current_latitude
    }
    
    const travel = await supabaseRequest('current_travel', {
      method: 'POST',
      body: JSON.stringify(travelData)
    })
    
    res.status(201).json({
      success: true,
      message: 'Travel started successfully',
      data: travel[0]
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  })
})

// Start server
async function startServer() {
  await testSupabaseConnection()
  
  app.listen(PORT, () => {
    console.log(`🚀 Smart Transit API running on port ${PORT}`)
    console.log(`📱 Test the API at: http://localhost:${PORT}/api/health`)
    console.log(`🗄️  Database status: ${supabaseConnected ? '✅ Connected' : '❌ Not connected'}`)
    
    if (supabaseConnected) {
      console.log(`🎉 Using Supabase REST API!`)
    } else {
      console.log(`⚠️  Supabase connection failed`)
      console.log(`💡 Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file`)
    }
    
    console.log(`\n🌐 Available endpoints:`)
    console.log(`   GET  /api/health`)
    console.log(`   GET  /api/users`)
    console.log(`   GET  /api/users/:id`)
    console.log(`   POST /api/users`)
    console.log(`   PATCH /api/users/:id/balance`)
    console.log(`   GET  /api/users/:id/travels`)
    console.log(`   GET  /api/users/:id/recharges`)
    console.log(`   POST /api/recharge`)
    console.log(`   GET  /api/buses`)
    console.log(`   POST /api/travel/start`)
  })
}

startServer().catch(console.error)
