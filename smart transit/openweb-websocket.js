// Smart Transit Web Application with Supabase and WebSocket Support
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { exec } from 'child_process'
import os from 'os'
import path from 'path'
import methodOverride from 'method-override'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import session from 'express-session'
import flash from 'connect-flash'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    methods: ["GET", "POST"]
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

// Arduino/ESP integration configuration
const ARDUINO_WIFI = {
  ssid: 'Tushar',
  password: '12345678'
}

// Store for RFID card scans (in memory - in production use database)
let recentCardScans = new Map()
const SCAN_DEBOUNCE_TIME = 3000 // 3 seconds

// Geoapify API configuration
const GEOAPIFY_API_KEY = '7fa23b5a9b194102a9be9a11ce64a57c'

// Function to calculate distance between two coordinates using Geoapify
async function calculateTravelDistance(originCoords, destinationCoords) {
  try {
    const origin = `${originCoords.latitude},${originCoords.longitude}`
    const destination = `${destinationCoords.latitude},${destinationCoords.longitude}`
    
    const url = `https://api.geoapify.com/v1/routing?waypoints=${origin}|${destination}&mode=transit&apiKey=${GEOAPIFY_API_KEY}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data && data.features && data.features.length > 0) {
      const route = data.features[0].properties
      return {
        distance: route.distance, // meters
        duration: route.time,     // seconds
        distanceKm: (route.distance / 1000).toFixed(2)
      }
    } else {
      console.error('No route found from Geoapify API')
      return null
    }
  } catch (error) {
    console.error('Error calculating distance:', error)
    return null
  }
}

// Function to calculate fare based on distance
function calculateFare(distanceKm) {
  const baseFare = 10 // Base fare in BDT
  const perKmRate = 5 // Rate per km in BDT
  return Math.ceil(baseFare + (distanceKm * perKmRate))
}

// Helper function to make Supabase REST API calls
async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured')
  }
  
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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`WebSocket client connected: ${socket.id}`)
  
  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.id}`)
  })
  
  // Handle RFID simulation from frontend
  socket.on('simulate_rfid', async (data) => {
    console.log('RFID simulation request:', data)
    
    try {
      // Simulate the same logic as the Arduino endpoint
      const response = await handleRFIDScan(data, 'WEB_SIMULATOR')
      
      // Broadcast to all connected clients
      io.emit('rfid_scan', {
        ...data,
        response,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('RFID simulation error:', error)
    }
  })
})

// Function to get wireless IP address
function getWirelessIPAddress() {
  const networkInterfaces = os.networkInterfaces()
  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName]
    for (const networkAddress of networkInterface) {
      if (networkAddress.family === 'IPv4' && !networkAddress.internal) {
        if (interfaceName.toLowerCase().includes('wi-fi') || 
            interfaceName.toLowerCase().includes('wireless') ||
            interfaceName.toLowerCase().includes('wlan')) {
          return networkAddress.address
        }
      }
    }
  }
  return 'IP not found'
}

// Enhanced RFID handling function with location tracking (safe version)
async function handleRFIDScan(data, deviceSource = 'ARDUINO') {
  try {
    const { card_id, device_id, location, latitude, longitude } = data
    
    if (!card_id) {
      return { 
        success: false, 
        message: 'Card ID is required',
        action: 'error_beep'
      }
    }

    const now = Date.now()
    const lastScan = recentCardScans.get(card_id)
    
    // Debounce duplicate scans
    if (lastScan && (now - lastScan) < SCAN_DEBOUNCE_TIME) {
      return {
        success: true,
        message: 'Scan ignored (duplicate)',
        action: 'no_action'
      }
    }
    
    recentCardScans.set(card_id, now)
    
    // Find user by card_id
    const users = await supabaseRequest(`user_profile?card_id=eq.${card_id}&select=*`)
    
    if (users.length === 0) {
      return {
        success: false,
        message: 'Card not registered',
        action: 'error_beep',
        display: ['Invalid Card', 'Not Registered']
      }
    }
    
    const user = users[0]
    
    // Check if user has sufficient balance
    if (user.balance < 10) { // Minimum fare
      return {
        success: false,
        message: 'Insufficient balance',
        action: 'error_beep',
        display: [`Low Balance`, `BDT ${user.balance}`]
      }
    }
    
    // Check if user has active travel
    const activeTravel = await supabaseRequest(`current_travel?user_id=eq.${user.user_id}&select=*`)
    
    if (activeTravel.length > 0) {
      // End current travel - DESTINATION SCAN
      const travel = activeTravel[0]
      let calculatedFare = 15 // Default fare
      let distanceInfo = null
      
      // Try to calculate distance if coordinates are available
      try {
        if (latitude && longitude && travel.pick_point) {
          // Simple distance calculation (in real implementation, you'd use proper coordinates)
          // For now, use a basic fare calculation based on travel time
          const travelStartTime = new Date(travel.created_at)
          const travelDuration = (now - travelStartTime.getTime()) / 1000 // seconds
          const travelMinutes = Math.floor(travelDuration / 60)
          
          // Dynamic fare: base + time-based
          calculatedFare = Math.max(15, 10 + Math.floor(travelMinutes / 5) * 5) // 5 BDT per 5 minutes
          
          distanceInfo = {
            duration: travelDuration,
            durationMinutes: travelMinutes,
            distanceKm: 'Calculated'
          }
        }
      } catch (distanceError) {
        console.log('Distance calculation failed, using default fare:', distanceError.message)
      }
      
      const newBalance = user.balance - calculatedFare
      
      if (newBalance < 0) {
        return {
          success: false,
          message: 'Insufficient balance for this journey',
          action: 'error_beep',
          display: [`Fare: ${calculatedFare} BDT`, `Balance: ${user.balance} BDT`]
        }
      }
      
      // Update user balance
      await supabaseRequest(`user_profile?user_id=eq.${user.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: newBalance })
      })
      
      // Move to travel history
      await supabaseRequest('travel_history', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          pick_point: travel.pick_point,
          drop_point: location || 'Unknown Destination',
          total_cost: calculatedFare,
          remaining_balance: newBalance,
          travel_time: travel.created_at
        })
      })
      
      // Delete from current travel
      await supabaseRequest(`current_travel?user_id=eq.${user.user_id}`, {
        method: 'DELETE'
      })
      
      // Broadcast user update via WebSocket
      io.emit('user_update', {
        user_id: user.user_id,
        balance: newBalance,
        action: 'travel_end'
      })
      
      return {
        success: true,
        message: 'Travel ended',
        action: 'success_beep',
        display: [
          `Journey Complete`,
          distanceInfo ? `${distanceInfo.durationMinutes}min - ${calculatedFare} BDT` : `Fare: ${calculatedFare} BDT`
        ],
        user: {
          name: user.name,
          balance: newBalance,
          fare_deducted: calculatedFare,
          travel_info: distanceInfo
        }
      }
      
    } else {
      // Start new travel - ORIGIN SCAN
      await supabaseRequest('current_travel', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          pick_point: location || 'Unknown Origin',
          current_longitude: longitude || 0,
          current_latitude: latitude || 0
        })
      })
      
      // Broadcast travel update via WebSocket
      io.emit('travel_update', {
        user_id: user.user_id,
        action: 'travel_start',
        pick_point: location || 'Unknown Origin',
        coordinates: { latitude, longitude }
      })
      
      return {
        success: true,
        message: 'Travel started',
        action: 'success_beep',
        display: [`Welcome ${user.name}`, `Journey Started`],
        user: {
          name: user.name,
          balance: user.balance,
          origin_location: location || 'City Terminal'
        }
      }
    }
  } catch (error) {
    console.error('RFID Scan Error:', error)
    return {
      success: false,
      message: 'System error',
      action: 'error_beep',
      display: ['System Error', 'Try Again']
    }
  }
}

// Middleware setup
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "apikey"],
  credentials: true
}))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'public', 'ejs'))
app.set('view engine', 'ejs')

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}

app.use(session(sessionConfig))
app.use(flash())

// Middleware to pass flash messages to all templates
app.use((req, res, next) => {
  res.locals.success = req.flash('success')
  res.locals.error = req.flash('error')
  next()
})

// Routes

// Home route
app.get('/', (req, res) => {
  res.render('home')
})

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Smart Transit API is running',
    timestamp: new Date().toISOString(),
    database: SUPABASE_URL ? 'Configured' : 'Not configured',
    websocket: 'Enabled',
    arduino: {
      wifi_ssid: ARDUINO_WIFI.ssid,
      rfid_status: 'Ready'
    }
  })
})

// Enhanced RFID Card scan endpoint for Arduino ESP
app.post('/api/rfid/scan', async (req, res) => {
  try {
    const response = await handleRFIDScan(req.body, 'ARDUINO')
    
    // Broadcast scan event via WebSocket
    io.emit('rfid_scan', {
      ...req.body,
      response,
      timestamp: new Date().toISOString(),
      source: 'ARDUINO'
    })
    
    res.json(response)
    
  } catch (error) {
    console.error('RFID scan error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'System error',
      action: 'error_beep',
      display: ['System Error', 'Try Again']
    })
  }
})

// Arduino configuration endpoint
app.get('/api/arduino/config', (req, res) => {
  res.json({
    success: true,
    config: {
      wifi: {
        ssid: ARDUINO_WIFI.ssid,
        // Don't send password in response for security
        password_configured: !!ARDUINO_WIFI.password
      },
      server: {
        host: getWirelessIPAddress(),
        port: PORT,
        endpoint: '/api/rfid/scan'
      },
      settings: {
        scan_debounce_ms: SCAN_DEBOUNCE_TIME,
        servo_delay_ms: 2000,
        buzzer_duration_ms: 200
      }
    }
  })
})

app.get('/api/users', async (req, res) => {
  try {
    const users = await supabaseRequest('user_profile?select=user_id,name,email,phone,card_id,balance,created_at&order=user_id')
    res.json({ success: true, data: users, count: users.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get currently traveling users (online users)
app.get('/api/current-travel', async (req, res) => {
  try {
    const currentTravels = await supabaseRequest('current_travel?select=user_id,pick_point,current_longitude,current_latitude,created_at,user_profile(name,email,card_id,balance)&order=created_at.desc')
    res.json({ success: true, data: currentTravels, count: currentTravels.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get travel history for all users or specific user
app.get('/api/travel-history', async (req, res) => {
  try {
    const { user_id, limit = 50 } = req.query
    let query = 'travel_history?select=user_id,pick_point,drop_point,total_cost,remaining_balance,travel_time,user_profile(name,email,card_id)'
    
    if (user_id) {
      query += `&user_id=eq.${user_id}`
    }
    
    query += `&order=travel_time.desc&limit=${limit}`
    
    const travelHistory = await supabaseRequest(query)
    res.json({ success: true, data: travelHistory, count: travelHistory.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get current travel status (users currently on bus)
app.get('/api/current-travel', async (req, res) => {
  try {
    const currentTravel = await supabaseRequest(`
      current_travel?select=
        user_id,
        pick_point,
        current_longitude,
        current_latitude,
        created_at,
        user_profile!inner(name,email,card_id)
      &order=created_at.desc
    `)
    res.json({ success: true, data: currentTravel, count: currentTravel.length })
  } catch (error) {
    console.error('Current travel API error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get travel history for a specific user
app.get('/api/travel-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const travelHistory = await supabaseRequest(`
      travel_history?user_id=eq.${userId}&select=
        user_id,
        pick_point,
        drop_point,
        total_cost,
        remaining_balance,
        travel_time
      &order=travel_time.desc&limit=20
    `)
    res.json({ success: true, data: travelHistory, count: travelHistory.length })
  } catch (error) {
    console.error('Travel history API error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all travel history
app.get('/api/travel-history', async (req, res) => {
  try {
    const travelHistory = await supabaseRequest(`
      travel_history?select=
        user_id,
        pick_point,
        drop_point,
        total_cost,
        remaining_balance,
        travel_time,
        user_profile!inner(name,email,card_id)
      &order=travel_time.desc&limit=50
    `)
    res.json({ success: true, data: travelHistory, count: travelHistory.length })
  } catch (error) {
    console.error('All travel history API error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Login routes (keeping existing functionality)
app.get('/login', (req, res) => {
  res.render('login')
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      req.flash('error', 'Email and password are required')
      return res.redirect('/login')
    }
    
    const users = await supabaseRequest(`user_profile?email=eq.${email}&select=user_id,name,email,password`)
    
    if (users.length === 0) {
      req.flash('error', 'Invalid email or password')
      return res.redirect('/login')
    }
    
    const user = users[0]
    
    if (user.password !== password) {
      req.flash('error', 'Invalid email or password')
      return res.redirect('/login')
    }
    
    req.session.user = {
      id: user.user_id,
      name: user.name,
      email: user.email
    }
    
    req.flash('success', `Welcome back, ${user.name}!`)
    res.redirect('/user')
    
  } catch (error) {
    console.error('Login error:', error)
    req.flash('error', 'Login failed. Please try again.')
    res.redirect('/login')
  }
})

// User dashboard
app.get('/user', async (req, res) => {
  if (!req.session.user) {
    req.flash('error', 'Please log in to access this page')
    return res.redirect('/login')
  }
  
  try {
    const users = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=*`)
    const user = users[0]
    
    const travels = await supabaseRequest(`travel_history?user_id=eq.${req.session.user.id}&order=travel_time.desc&limit=5`)
    const recharges = await supabaseRequest(`recharge_history?user_id=eq.${req.session.user.id}&order=recharge_date.desc&limit=5`)
    
    res.render('user', { user, travels, recharges })
    
  } catch (error) {
    console.error('User dashboard error:', error)
    req.flash('error', 'Failed to load user dashboard')
    res.redirect('/login')
  }
})

// Recharge route
app.post('/recharge', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' })
  }
  
  try {
    const { amount, payment_method } = req.body
    
    if (!amount || !payment_method) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount and payment method are required' 
      })
    }
    
    const recharge = await supabaseRequest('recharge_history', {
      method: 'POST',
      body: JSON.stringify({
        user_id: req.session.user.id,
        recharge_amount: parseFloat(amount),
        payment_method
      })
    })
    
    const currentUser = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=balance`)
    const newBalance = currentUser[0].balance + parseFloat(amount)
    
    await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: newBalance })
    })
    
    // Broadcast balance update via WebSocket
    io.emit('user_update', {
      user_id: req.session.user.id,
      balance: newBalance,
      action: 'recharge'
    })
    
    res.json({
      success: true,
      message: 'Recharge successful',
      data: { new_balance: newBalance }
    })
    
  } catch (error) {
    console.error('Recharge error:', error)
    res.status(500).json({ success: false, message: 'Recharge failed' })
  }
})

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
    }
    res.redirect('/login')
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).render('error', { error: 'Something went wrong!' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).render('error', { error: 'Page not found!' })
})

// Start the server
const PORT = process.env.PORT || 2000

server.listen(PORT, () => {
  console.log(`YOUR IP IS ${getWirelessIPAddress()}`)
  console.log(`Smart Transit server is running on port ${PORT}...`)
  console.log(`🌐 Access your app at:`)
  console.log(`   Local: http://localhost:${PORT}`)
  console.log(`   Network: http://${getWirelessIPAddress()}:${PORT}`)
  console.log(`🗄️  Database: ${SUPABASE_URL ? '✅ Supabase Connected' : '❌ Not configured'}`)
  console.log(`🔌 WebSocket: ✅ Enabled`)
  console.log(`📱 Frontend: http://localhost:3000`)
})
