// API structure demo (works without database connection)
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 2000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Mock data for demonstration
const mockUsers = [
  {
    user_id: 'U000001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    card_id: '520028A3A0',
    balance: 500.00,
    age: 28
  },
  {
    user_id: 'U000002', 
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    card_id: '520028B840',
    balance: 1000.00,
    age: 32
  }
]

// API Routes for demonstration

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Smart Transit API is running',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
  })
})

// Get all users (mock)
app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    data: mockUsers,
    count: mockUsers.length
  })
})

// Get user by ID (mock)
app.get('/api/users/:id', (req, res) => {
  const user = mockUsers.find(u => u.user_id === req.params.id)
  if (user) {
    res.json({ success: true, data: user })
  } else {
    res.status(404).json({ success: false, message: 'User not found' })
  }
})

// Create user (mock)
app.post('/api/users', (req, res) => {
  const { name, email, phone, card_id, balance, dob, address } = req.body
  
  // Validate required fields
  if (!name || !email || !card_id || !address) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, email, card_id, address'
    })
  }
  
  const newUser = {
    user_id: `U${String(mockUsers.length + 1).padStart(6, '0')}`,
    name,
    email,
    phone: phone || null,
    card_id,
    balance: parseFloat(balance) || 0.00,
    age: dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null,
    created_at: new Date().toISOString()
  }
  
  mockUsers.push(newUser)
  
  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: newUser
  })
})

// Update user balance (mock)
app.patch('/api/users/:id/balance', (req, res) => {
  const user = mockUsers.find(u => u.user_id === req.params.id)
  const { balance } = req.body
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }
  
  if (balance === undefined || isNaN(parseFloat(balance))) {
    return res.status(400).json({ success: false, message: 'Invalid balance amount' })
  }
  
  user.balance = parseFloat(balance)
  
  res.json({
    success: true,
    message: 'Balance updated successfully',
    data: { user_id: user.user_id, balance: user.balance }
  })
})

// Get travel history (mock)
app.get('/api/users/:id/travels', (req, res) => {
  const mockTravels = [
    {
      history_id: 'T001',
      user_id: req.params.id,
      travel_date: '2025-08-23',
      travel_time: '2025-08-23T10:30:00Z',
      pick_point: 'Dhanmondi 27',
      drop_point: 'Gulshan 1',
      total_cost: 25.00,
      remaining_balance: 475.00
    }
  ]
  
  res.json({
    success: true,
    data: mockTravels,
    count: mockTravels.length
  })
})

// Get recharge history (mock)
app.get('/api/users/:id/recharges', (req, res) => {
  const mockRecharges = [
    {
      recharge_id: 'R001',
      user_id: req.params.id,
      recharge_date: '2025-08-23T09:00:00Z',
      recharge_amount: 100.00,
      payment_method: 'BKASH'
    }
  ]
  
  res.json({
    success: true,
    data: mockRecharges,
    count: mockRecharges.length
  })
})

// Create recharge (mock)
app.post('/api/recharge', (req, res) => {
  const { user_id, amount, payment_method } = req.body
  
  if (!user_id || !amount || !payment_method) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: user_id, amount, payment_method'
    })
  }
  
  const recharge = {
    recharge_id: `R${Date.now()}`,
    user_id,
    recharge_date: new Date().toISOString(),
    recharge_amount: parseFloat(amount),
    payment_method
  }
  
  res.status(201).json({
    success: true,
    message: 'Recharge created successfully',
    data: recharge
  })
})

// Get all buses (mock)
app.get('/api/buses', (req, res) => {
  const mockBuses = [
    { bus_id: 'B1', total_seats: 50, available_seats: 35, per_km_cost: 5.00 },
    { bus_id: 'B2', total_seats: 50, available_seats: 42, per_km_cost: 5.00 }
  ]
  
  res.json({
    success: true,
    data: mockBuses,
    count: mockBuses.length
  })
})

// Start current travel (mock)
app.post('/api/travel/start', (req, res) => {
  const { user_id, pick_point, current_longitude, current_latitude } = req.body
  
  if (!user_id || !pick_point) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: user_id, pick_point'
    })
  }
  
  const travel = {
    travel_id: `T${Date.now()}`,
    user_id,
    pick_point,
    drop_point: null,
    per_km_cost: 5.00,
    total_cost: null,
    current_longitude,
    current_latitude,
    dropoff_longitude: null,
    dropoff_latitude: null,
    travel_date: new Date().toISOString().split('T')[0],
    travel_status: 'ONGOING',
    created_at: new Date().toISOString()
  }
  
  res.status(201).json({
    success: true,
    message: 'Travel started successfully',
    data: travel
  })
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
app.listen(PORT, () => {
  console.log(`🚀 Smart Transit API Demo running on port ${PORT}`)
  console.log(`📱 Test the API at: http://localhost:${PORT}/api/health`)
  console.log(`🌐 Available endpoints:`)
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
  
  if (!process.env.DATABASE_URL) {
    console.log(`\n⚠️  Note: Running with mock data (no database connection)`)
    console.log(`   Configure DATABASE_URL in .env to use real database`)
  }
})
