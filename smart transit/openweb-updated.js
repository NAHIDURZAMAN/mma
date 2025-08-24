// Smart Transit Web Application with Supabase
import dotenv from 'dotenv'
import express from 'express'
import { exec } from 'child_process'
import os from 'os'
import path from 'path'
import methodOverride from 'method-override'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import session from 'express-session'
import flash from 'connect-flash'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Load environment variables
dotenv.config()

const app = express()
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

// Middleware setup
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

// Routes

// Home route
app.get('/', (req, res) => {
  res.render('home')
})

// Login routes
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
    
    // Find user by email
    const users = await supabaseRequest(`user_profile?email=eq.${email}&select=user_id,name,email,password`)
    
    if (users.length === 0) {
      req.flash('error', 'Invalid email or password')
      return res.redirect('/login')
    }
    
    const user = users[0]
    
    // In a real app, you'd verify the hashed password
    // For now, we'll do a simple comparison
    if (user.password !== password) {
      req.flash('error', 'Invalid email or password')
      return res.redirect('/login')
    }
    
    // Set session
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
    // Get user details
    const users = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=*`)
    const user = users[0]
    
    // Get recent travels
    const travels = await supabaseRequest(`travel_history?user_id=eq.${req.session.user.id}&order=travel_time.desc&limit=5`)
    
    // Get recent recharges
    const recharges = await supabaseRequest(`recharge_history?user_id=eq.${req.session.user.id}&order=recharge_date.desc&limit=5`)
    
    res.render('user', { user, travels, recharges })
    
  } catch (error) {
    console.error('User dashboard error:', error)
    req.flash('error', 'Failed to load user dashboard')
    res.redirect('/login')
  }
})

// Profile route
app.get('/profile', async (req, res) => {
  if (!req.session.user) {
    req.flash('error', 'Please log in to access this page')
    return res.redirect('/login')
  }
  
  try {
    const users = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=*`)
    const user = users[0]
    res.render('profile', { user })
    
  } catch (error) {
    console.error('Profile error:', error)
    req.flash('error', 'Failed to load profile')
    res.redirect('/user')
  }
})

// Map route
app.get('/map', (req, res) => {
  if (!req.session.user) {
    req.flash('error', 'Please log in to access this page')
    return res.redirect('/login')
  }
  res.render('map')
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
    
    // Add recharge record
    const recharge = await supabaseRequest('recharge_history', {
      method: 'POST',
      body: JSON.stringify({
        user_id: req.session.user.id,
        recharge_amount: parseFloat(amount),
        payment_method
      })
    })
    
    // Update user balance
    const currentUser = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=balance`)
    const newBalance = currentUser[0].balance + parseFloat(amount)
    
    await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: newBalance })
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

// Start travel route
app.post('/travel/start', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' })
  }
  
  try {
    const { pick_point, current_longitude, current_latitude } = req.body
    
    if (!pick_point) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pick point is required' 
      })
    }
    
    const travel = await supabaseRequest('current_travel', {
      method: 'POST',
      body: JSON.stringify({
        user_id: req.session.user.id,
        pick_point,
        current_longitude,
        current_latitude
      })
    })
    
    res.json({
      success: true,
      message: 'Travel started successfully',
      data: travel[0]
    })
    
  } catch (error) {
    console.error('Start travel error:', error)
    res.status(500).json({ success: false, message: 'Failed to start travel' })
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

// API Routes (keeping the existing API for compatibility)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Smart Transit API is running',
    timestamp: new Date().toISOString(),
    database: SUPABASE_URL ? 'Configured' : 'Not configured',
    arduino: {
      wifi_ssid: ARDUINO_WIFI.ssid,
      rfid_status: 'Ready'
    }
  })
})

// RFID Card scan endpoint for Arduino ESP
app.post('/api/rfid/scan', async (req, res) => {
  try {
    const { card_id, device_id, location } = req.body
    
    if (!card_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Card ID is required',
        action: 'error_beep'
      })
    }
    
    const now = Date.now()
    const lastScan = recentCardScans.get(card_id)
    
    // Debounce duplicate scans
    if (lastScan && (now - lastScan) < SCAN_DEBOUNCE_TIME) {
      return res.json({
        success: true,
        message: 'Scan ignored (duplicate)',
        action: 'no_action'
      })
    }
    
    recentCardScans.set(card_id, now)
    
    // Find user by card_id
    const users = await supabaseRequest(`user_profile?card_id=eq.${card_id}&select=*`)
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Card not registered',
        action: 'error_beep',
        display: ['Invalid Card', 'Not Registered']
      })
    }
    
    const user = users[0]
    
    // Check if user has sufficient balance
    if (user.balance < 10) { // Minimum fare
      return res.json({
        success: false,
        message: 'Insufficient balance',
        action: 'error_beep',
        display: [`Low Balance`, `BDT ${user.balance}`]
      })
    }
    
    // Check if user has active travel
    const activeTravel = await supabaseRequest(`current_travel?user_id=eq.${user.user_id}&select=*`)
    
    if (activeTravel.length > 0) {
      // End current travel
      const travel = activeTravel[0]
      const fare = 15 // Fixed fare for demo
      const newBalance = user.balance - fare
      
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
          drop_point: location || 'Unknown',
          total_cost: fare,
          remaining_balance: newBalance,
          travel_time: travel.created_at
        })
      })
      
      // Delete from current travel
      await supabaseRequest(`current_travel?user_id=eq.${user.user_id}`, {
        method: 'DELETE'
      })
      
      return res.json({
        success: true,
        message: 'Travel ended',
        action: 'success_beep',
        display: [`Journey End`, `Fare: ${fare} BDT`],
        user: {
          name: user.name,
          balance: newBalance,
          fare_deducted: fare
        }
      })
      
    } else {
      // Start new travel
      await supabaseRequest('current_travel', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          pick_point: location || 'Unknown',
          current_longitude: 0,
          current_latitude: 0
        })
      })
      
      return res.json({
        success: true,
        message: 'Travel started',
        action: 'success_beep',
        display: [`Welcome ${user.name}`, `Balance: ${user.balance}`],
        user: {
          name: user.name,
          balance: user.balance
        }
      })
    }
    
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

app.listen(PORT, () => {
  console.log(`YOUR IP IS ${getWirelessIPAddress()}`)
  console.log(`Smart Transit server is running on port ${PORT}...`)
  console.log(`🌐 Access your app at:`)
  console.log(`   Local: http://localhost:${PORT}`)
  console.log(`   Network: http://${getWirelessIPAddress()}:${PORT}`)
  console.log(`🗄️  Database: ${SUPABASE_URL ? '✅ Supabase Connected' : '❌ Not configured'}`)
})
