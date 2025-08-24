// Real Smart Transit API with Supabase Database
import express from 'express'
import dotenv from 'dotenv'
import sql from './db.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 2000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Test database connection on startup
let dbConnected = false

async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`
    console.log('✅ Database connected successfully!')
    console.log('⏰ Server time:', result[0].current_time)
    dbConnected = true
  } catch (error) {
    console.log('❌ Database connection failed:', error.message)
    console.log('⚠️  Running with fallback mode')
    dbConnected = false
  }
}

// Database helper functions
const dbHelpers = {
  // Get all users
  async getUsers() {
    return await sql`SELECT user_id, name, email, phone, card_id, balance, created_at FROM user_profile ORDER BY user_id`
  },

  // Get user by ID
  async getUserById(userId) {
    const result = await sql`SELECT user_id, name, email, phone, card_id, balance, created_at FROM user_profile WHERE user_id = ${userId}`
    return result[0]
  },

  // Get user by email
  async getUserByEmail(email) {
    const result = await sql`SELECT user_id, name, email, phone, card_id, balance, created_at FROM user_profile WHERE email = ${email}`
    return result[0]
  },

  // Create user
  async createUser(userData) {
    const { name, email, phone, card_id, balance, dob, address, password } = userData
    const result = await sql`
      INSERT INTO user_profile (name, email, phone, card_id, balance, dob, address, password)
      VALUES (${name}, ${email}, ${phone}, ${card_id}, ${balance || 0}, ${dob}, ${address}, ${password})
      RETURNING user_id, name, email, phone, card_id, balance, created_at
    `
    return result[0]
  },

  // Update user balance
  async updateBalance(userId, newBalance) {
    const result = await sql`
      UPDATE user_profile 
      SET balance = ${newBalance}
      WHERE user_id = ${userId}
      RETURNING user_id, balance
    `
    return result[0]
  },

  // Get all buses
  async getBuses() {
    return await sql`SELECT * FROM bus_info ORDER BY bus_id`
  },

  // Get travel history
  async getTravelHistory(userId, limit = 10) {
    return await sql`
      SELECT * FROM travel_history 
      WHERE user_id = ${userId}
      ORDER BY travel_time DESC
      LIMIT ${limit}
    `
  },

  // Get recharge history
  async getRechargeHistory(userId, limit = 10) {
    return await sql`
      SELECT * FROM recharge_history 
      WHERE user_id = ${userId}
      ORDER BY recharge_date DESC
      LIMIT ${limit}
    `
  },

  // Add recharge record
  async addRecharge(userId, amount, paymentMethod) {
    const result = await sql`
      INSERT INTO recharge_history (user_id, recharge_amount, payment_method)
      VALUES (${userId}, ${amount}, ${paymentMethod})
      RETURNING recharge_id, recharge_date, recharge_amount, payment_method
    `
    return result[0]
  },

  // Start travel
  async startTravel(travelData) {
    const { user_id, pick_point, current_longitude, current_latitude } = travelData
    const result = await sql`
      INSERT INTO current_travel (user_id, pick_point, current_longitude, current_latitude)
      VALUES (${user_id}, ${pick_point}, ${current_longitude}, ${current_latitude})
      RETURNING travel_id, user_id, pick_point, travel_status, created_at
    `
    return result[0]
  }
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'Unknown'
  let dbTime = null

  if (dbConnected) {
    try {
      const result = await sql`SELECT NOW() as current_time`
      dbStatus = 'Connected'
      dbTime = result[0].current_time
    } catch (error) {
      dbStatus = 'Error: ' + error.message
    }
  } else {
    dbStatus = 'Not connected'
  }

  res.json({
    status: 'OK',
    message: 'Smart Transit API is running',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    serverTime: dbTime
  })
})

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const users = await dbHelpers.getUsers()
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
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const user = await dbHelpers.getUserById(req.params.id)
    if (user) {
      res.json({ success: true, data: user })
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
    if (!dbConnected) {
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
    
    const newUser = await dbHelpers.createUser({
      name, email, phone, card_id, balance, dob, address, password
    })
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Update user balance
app.patch('/api/users/:id/balance', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { balance } = req.body
    
    if (balance === undefined || isNaN(parseFloat(balance))) {
      return res.status(400).json({ success: false, message: 'Invalid balance amount' })
    }
    
    const result = await dbHelpers.updateBalance(req.params.id, parseFloat(balance))
    
    if (result) {
      res.json({
        success: true,
        message: 'Balance updated successfully',
        data: result
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
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const travels = await dbHelpers.getTravelHistory(req.params.id, 10)
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
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const recharges = await dbHelpers.getRechargeHistory(req.params.id, 10)
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
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { user_id, amount, payment_method } = req.body
    
    if (!user_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, amount, payment_method'
      })
    }
    
    const recharge = await dbHelpers.addRecharge(user_id, parseFloat(amount), payment_method)
    
    res.status(201).json({
      success: true,
      message: 'Recharge created successfully',
      data: recharge
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all buses
app.get('/api/buses', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const buses = await dbHelpers.getBuses()
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
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' })
    }

    const { user_id, pick_point, current_longitude, current_latitude } = req.body
    
    if (!user_id || !pick_point) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, pick_point'
      })
    }
    
    const travel = await dbHelpers.startTravel({
      user_id, pick_point, current_longitude, current_latitude
    })
    
    res.status(201).json({
      success: true,
      message: 'Travel started successfully',
      data: travel
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
  await testConnection()
  
  app.listen(PORT, () => {
    console.log(`🚀 Smart Transit API running on port ${PORT}`)
    console.log(`📱 Test the API at: http://localhost:${PORT}/api/health`)
    console.log(`🗄️  Database status: ${dbConnected ? '✅ Connected' : '❌ Not connected'}`)
    
    if (dbConnected) {
      console.log(`🎉 Using real Supabase database!`)
    } else {
      console.log(`⚠️  Database connection failed - API will return errors`)
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
