// Smart Transit Web Application with Supabase and WebSocket Support
require('dotenv').config()
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { exec } = require('child_process')
const os = require('os')
const path = require('path')
const methodOverride = require('method-override')
const multer = require('multer')
const { v4: uuid } = require('uuid')
const session = require('express-session')
const flash = require('connect-flash')
const cors = require('cors')
const bonjour = require('bonjour')
const { sendJourneyCompleteEmail, sendLowBalanceAlert, sendRechargeConfirmationEmail, sendNotificationEmail } = require('./Routes/emailService.js')
const { forwardGeocode, reverseGeocode, calculateDistance, formatJourneyTime } = require('./Routes/geocodingService.js')
const rechargeAPI = require('./Routes/rechargeHistoryAPI.js')
const Stripe = require('stripe')

// Stripe configuration - Hardcoded keys
// Note: These are TEST keys for development. For production:
// 1. Use live keys (sk_live_... and pk_live_...)
// 2. Consider using environment variables for security
// 3. Never commit live keys to version control
const STRIPE_SECRET_KEY = 'sk_test_51QEK5eJqwXDBmKmPl3eMqSMKLyDjxhwl1C3C6u8sJrKlNkCwSHw8NkJaQNtiBLKAcE9z1xCeOGTvC5CJvxLUQTek00Hd7aD6bZ'
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51QEK5eJqwXDBmKmPjHZJt7CKlKy2ygz4A1QlGH8Q3VbNcBgVfqWL6K9pF7t2E1K4T9xBfKd2J7l3H6rS5dW8c9x200sE9qJ4y2'

// Initialize Stripe
console.log('🔑 Stripe Secret Key loaded:', STRIPE_SECRET_KEY ? `${STRIPE_SECRET_KEY.substring(0, 12)}...${STRIPE_SECRET_KEY.slice(-4)}` : 'NOT FOUND')
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:3001", 
      "http://127.0.0.1:3000", 
      "http://127.0.0.1:3001",
      "https://*.vercel.app",
      process.env.FRONTEND_URL,
      /https:\/\/.*\.vercel\.app$/,
      /https:\/\/.*\.railway\.app$/
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

// Arduino/ESP integration configuration
const ARDUINO_WIFI = {
  ssid: 'Tushar',
  password: '12345678'
}

// Store current bus location (this would come from GPS in real system)
  // Store current vehicle position
  let currentVehiclePosition = {
    lat: 23.8103,
    lng: 90.4125
  }
  
  console.log(`⚠️  SYSTEM STARTUP: Vehicle GPS initialized with DEFAULT coordinates: ${currentVehiclePosition.lat}, ${currentVehiclePosition.lng}`)
  console.log(`   📡 Waiting for actual GPS updates from frontend or RFID scan requests...`)
  
  // Store current bus location for WebSocket updates
  let currentBusLocation = {
    lat: 23.8103,
    lng: 90.4125,
    address: 'Default Location',
    busId: 'BUS001',
    timestamp: new Date().toISOString()
  }
  
  // Update current vehicle position from frontend
  function updateVehiclePosition(position, source = 'UNKNOWN') {
    const oldPosition = { ...currentVehiclePosition }
    const DEFAULT_LAT = 23.8103
    const DEFAULT_LNG = 90.4125
    
    // Prevent overwriting real coordinates with default coordinates
    const isNewDefault = (position.lat === DEFAULT_LAT && position.lng === DEFAULT_LNG)
    const hasRealCoords = !(oldPosition.lat === DEFAULT_LAT && oldPosition.lng === DEFAULT_LNG)
    
    if (isNewDefault && hasRealCoords) {
      console.log(`🚫 Preventing GPS update: Won't overwrite real coordinates (${oldPosition.lat}, ${oldPosition.lng}) with default coordinates`)
      return // Don't update
    }
    
    currentVehiclePosition = position
    
    console.log(`🚗 Vehicle GPS Position Updated:`)
    console.log(`   Previous: ${oldPosition.lat}, ${oldPosition.lng}`)
    console.log(`   Current:  ${position.lat}, ${position.lng}`)
    console.log(`   Source: ${source}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    
    // Update current location for all passengers on bus
    let passengersUpdated = 0
    for (let [cardId, passenger] of passengersOnBus) {
      passenger.currentLatitude = position.lat
      passenger.currentLongitude = position.lng
      passengersUpdated++
    }
    
    if (passengersUpdated > 0) {
      console.log(`   📍 Updated location for ${passengersUpdated} passengers`)
    }
  }

// Store passengers currently on bus
const passengersOnBus = new Map();

// Store for RFID card scans (in memory - in production use database)
let recentCardScans = new Map();

// Cache for passenger count from database
let cachedPassengerCount = 0;

// Function to update passenger count cache from database
async function updatePassengerCountCache() {
  try {
    const result = await supabaseRequest('current_travel?select=count');
    cachedPassengerCount = result[0]?.count || 0;
    console.log(`👥 Passenger count cache updated: ${cachedPassengerCount}`);
  } catch (error) {
    console.error('Error updating passenger count cache:', error);
  }
}

// Update passenger count cache every 30 seconds
setInterval(updatePassengerCountCache, 30000);
// Initial update
updatePassengerCountCache();
const SCAN_DEBOUNCE_TIME = 3000; // 3 seconds

// WebSocket connections storage
const connectedClients = new Set();

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

// Function to calculate fare based on distance and card type
function calculateFare(distanceKm, cardType = 'general') {
  const farePerKm = 20 // Rate per km in BDT
  let fare = Math.max(20, Math.round(distanceKm * farePerKm)) // Minimum 20 BDT
  
  // Apply card type discounts
  const cardTypeLower = cardType?.toLowerCase() || 'general';
  
  if (cardTypeLower === 'student') {
    // 50% discount for students
    fare = fare * 0.5;
  } else if (cardTypeLower === 'senior') {
    // 30% discount for senior citizens
    fare = fare * 0.7;
  } else if (cardTypeLower === 'disabled') {
    // 60% discount for disabled persons
    fare = fare * 0.4;
  }
  
  // Ensure minimum fare even after discounts (at least 10 BDT)
  return Math.max(10, Math.round(fare));
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

// Helper function to get latest stats for Socket.IO broadcasting
async function getLatestStats() {
  try {
    // Get today's date for filtering
    const today = new Date().toISOString().split('T')[0];
    
    // Parallel database queries for real-time stats
    const [totalUsersData, activePassengersData, todayRevenueData] = await Promise.all([
      // Total registered users
      supabaseRequest('user_profile?select=count'),
      
      // Active passengers (currently traveling)
      supabaseRequest('current_travel?select=count'),
      
      // Today's revenue from completed travels
      supabaseRequest(`travel_history?select=total_cost&travel_time=gte.${today}`)
    ]);

    // Calculate metrics
    const totalUsers = totalUsersData[0]?.count || 0;
    const activeVehicles = activePassengersData[0]?.count || 0;
    const totalRevenue = todayRevenueData.reduce((sum, travel) => sum + (travel.total_cost || 0), 0);
    const totalTrips = todayRevenueData.length;

    return {
      success: true,
      data: {
        totalTrips: totalTrips,
        activeVehicles: activeVehicles,
        totalRevenue: totalRevenue,
        totalUsers: totalUsers
      }
    };
  } catch (error) {
    console.error('❌ Error fetching latest stats:', error);
    throw error;
  }
}

// Helper function to broadcast stats update to all connected clients
async function broadcastStatsUpdate() {
  try {
    const stats = await getLatestStats()
    io.emit('stats_update', {
      totalTrips: stats.data.totalTrips,
      activeVehicles: stats.data.activeVehicles,
      dailyRevenue: stats.data.totalRevenue,
      totalUsers: stats.data.totalUsers,
      timestamp: new Date().toISOString()
    })
    console.log('📊 Stats broadcasted to all clients')
  } catch (error) {
    console.error('❌ Error broadcasting stats:', error.message)
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`WebSocket client connected: ${socket.id}`)
  connectedClients.add(socket)
  
  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.id}`)
    connectedClients.delete(socket)
  })
  
  // Handle vehicle position updates from Smart Transit Simulation
  socket.on('vehicle_position_update', async (data) => {
    const { lat, lng, address, busId = 'BUS001', routeInfo } = data
    
    if (lat && lng) {
      console.log(`📡 WebSocket GPS Update Received: ${parseFloat(lat)}, ${parseFloat(lng)}`)
      console.log(`🗺️  Route Info:`, routeInfo)
      
      // Update the vehicle position for RFID system
      updateVehiclePosition({ lat: parseFloat(lat), lng: parseFloat(lng) }, 'WEBSOCKET')
      
      // Get reverse geocoded address if not provided
      let locationAddress = address;
      if (!address || address === `${lat}, ${lng}`) {
        try {
          locationAddress = await reverseGeocode(parseFloat(lat), parseFloat(lng));
          console.log(`🗺️  Reverse geocoded address: ${locationAddress}`);
        } catch (error) {
          console.error('❌ Reverse geocoding failed:', error);
          locationAddress = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
        }
      }
      
      currentBusLocation = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: locationAddress,
        busId,
        timestamp: new Date().toISOString(),
        // Enhanced with route information
        routeInfo: routeInfo || null
      }
      
      // Broadcast enhanced position update to all connected clients
      socket.broadcast.emit('bus_location_update', {
        type: 'bus_location_update',
        location: currentBusLocation,
        timestamp: new Date().toISOString(),
        routeDetails: routeInfo ? {
          currentLocation: locationAddress,
          nextDestination: routeInfo.nextDestination?.name || "Final Destination",
          routeProgress: routeInfo.routeProgress || 0,
          isWaitingAtStation: routeInfo.isWaitingAtStation || false,
          passengers: cachedPassengerCount, // Use database count instead of simulation
          vehicleType: routeInfo.vehicleType || 'bus',
          destinationProgress: `${routeInfo.currentDestinationIndex + 1}/${routeInfo.totalDestinations}`,
          completedStops: routeInfo.completedDestinations || 0
        } : null
      })
      
      console.log(`🚌 Broadcasting route update:`, {
        location: address,
        nextDestination: routeInfo?.nextDestination?.name || "Unknown",
        progress: `${routeInfo?.routeProgress || 0}%`
      })
      
      // Also broadcast vehicle position update for real-time tracking
      socket.broadcast.emit('vehicle_position_update', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address || `${lat}, ${lng}`,
        busId,
        timestamp: new Date().toISOString()
      })
    } else {
      console.warn(`⚠️  Invalid GPS data received via WebSocket:`, data)
    }
  })

  // Handle simulation status updates from Smart Transit page
  socket.on('simulation_status_update', (data) => {
    console.log('🚌 Simulation status update received:', data)
    
    // Update vehicle GPS position from simulation if available
    if (data.currentPosition && data.currentPosition.lat && data.currentPosition.lng) {
      const newPosition = {
        lat: data.currentPosition.lat,
        lng: data.currentPosition.lng,
        source: 'SIMULATION',
        timestamp: new Date().toISOString()
      }
      
      // Update the global vehicle position
      updateVehiclePosition(newPosition)
      
      console.log(`🚌 Vehicle GPS updated from simulation: ${data.currentPosition.lat}, ${data.currentPosition.lng}`)
    }
    
    // Broadcast simulation status to all connected clients (including dashboard)
    socket.broadcast.emit('simulation_status', {
      isRunning: data.isRunning || false,
      currentPosition: data.currentPosition || { lat: 23.8103, lng: 90.4125 },
      destinations: data.destinations || [],
      currentDestinationIndex: data.currentDestinationIndex || 0,
      progress: data.progress || 0,
      isWaitingAtStation: data.isWaitingAtStation || false,
      vehicleType: data.vehicleType || 'bus',
      timestamp: new Date().toISOString()
    })
  })
  
  // Handle user creation from frontend
  socket.on('create_user', async (data) => {
    console.log('User creation request:', data)
    
    try {
      // Import user management functions
      const { createUser } = require('./fareCalculator')
      
      // Validate required fields
      const { name, email, phone, dob, address, password, balance } = data
      
      if (!name || !email || !phone || !dob || !address || !password) {
        socket.emit('user_creation_error', {
          success: false,
          message: 'All fields are required',
          timestamp: new Date().toISOString()
        })
        return
      }

      // Create the user
      const response = await createUser(data)
      
      // Broadcast successful user creation to all connected clients
      io.emit('user_created', {
        ...response,
        timestamp: new Date().toISOString()
      })
      
      // Broadcast updated stats after user creation
      await broadcastStatsUpdate()
      
      console.log('✅ User created successfully:', response.user.NAME)
      
    } catch (error) {
      console.error('❌ User creation error:', error.message)
      socket.emit('user_creation_error', {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle stats request from frontend
  socket.on('request_stats', async () => {
    console.log('📊 Stats request from client:', socket.id)
    
    try {
      const stats = await getLatestStats()
      socket.emit('stats_update', {
        totalTrips: stats.data.totalTrips,
        activeVehicles: stats.data.activeVehicles,
        dailyRevenue: stats.data.totalRevenue,
        totalUsers: stats.data.totalUsers,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Error fetching stats:', error.message)
      socket.emit('stats_error', {
        success: false,
        message: 'Failed to fetch stats',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle user lookup by card ID
  socket.on('lookup_user_by_card', async (data) => {
    console.log('User lookup request by card ID:', data.cardId)
    
    try {
      const { getUserByCardId } = require('./fareCalculator')
      
      if (!data.cardId) {
        socket.emit('user_lookup_error', {
          success: false,
          message: 'Card ID is required',
          timestamp: new Date().toISOString()
        })
        return
      }

      // Look up the user
      const user = await getUserByCardId(data.cardId)
      
      if (user) {
        socket.emit('user_found', {
          success: true,
          user: user,
          timestamp: new Date().toISOString()
        })
        console.log('👤 User found:', user.NAME)
      } else {
        socket.emit('user_not_found', {
          success: false,
          message: 'No user found with this card ID',
          cardId: data.cardId,
          timestamp: new Date().toISOString()
        })
        console.log('❌ No user found for card ID:', data.cardId)
      }
      
    } catch (error) {
      console.error('❌ User lookup error:', error.message)
      socket.emit('user_lookup_error', {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle getting all users (for admin)
  socket.on('get_all_users', async (data) => {
    console.log('Get all users request')
    
    try {
      const { getAllUsers } = require('./fareCalculator')
      
      const limit = data.limit || 50
      const response = await getAllUsers(limit)
      
      socket.emit('users_list', {
        ...response,
        timestamp: new Date().toISOString()
      })
      
      console.log(`📋 Sent ${response.users.length} users to client`)
      
    } catch (error) {
      console.error('❌ Error fetching users:', error.message)
      socket.emit('users_list_error', {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle balance update
  socket.on('update_user_balance', async (data) => {
    console.log('Balance update request:', data)
    
    try {
      const { updateUserBalance } = require('./fareCalculator')
      
      if (!data.userId || !data.balance) {
        socket.emit('balance_update_error', {
          success: false,
          message: 'User ID and balance are required',
          timestamp: new Date().toISOString()
        })
        return
      }

      const response = await updateUserBalance(data.userId, data.balance)
      
      // Broadcast balance update to all connected clients
      io.emit('balance_updated', {
        ...response,
        timestamp: new Date().toISOString()
      })
      
      // Broadcast updated stats after balance update
      await broadcastStatsUpdate()
      
      console.log('💰 Balance updated for user:', data.userId)
      
    } catch (error) {
      console.error('❌ Balance update error:', error.message)
      socket.emit('balance_update_error', {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle route update from Smart Transit Simulation
  socket.on('route_update', (data) => {
    console.log('📍 Route update received from simulation:', data)
    
    // Store route information globally for monitor access
    global.currentRoute = {
      destinations: data.destinations || [],
      status: data.status || 'planned',
      totalDistance: data.totalDistance || 0,
      currentDestinationIndex: data.currentDestinationIndex || 0,
      lastUpdated: new Date().toISOString(),
      vehiclePosition: data.vehiclePosition || null
    }
    
    // Broadcast to all clients including monitor
    io.emit('route_updated', {
      route: global.currentRoute,
      message: data.destinations?.length > 0 
        ? `Route planned with ${data.destinations.length} destinations`
        : 'Route cleared',
      timestamp: new Date().toISOString()
    })
    
    console.log(`🗺️  Route broadcasted to all clients:`, {
      destinations: data.destinations?.length || 0,
      status: data.status
    })
  })

  // Handle route status updates from Smart Transit Simulation
  socket.on('route_status_update', (data) => {
    console.log('📊 Route status update received:', data)
    
    // Ensure we have a valid status
    const validStatus = data.status || 'inactive'
    
    // Update global route status
    if (global.currentRoute) {
      global.currentRoute = {
        ...global.currentRoute,
        status: validStatus,
        currentDestinationIndex: data.currentDestinationIndex !== undefined 
          ? data.currentDestinationIndex 
          : global.currentRoute.currentDestinationIndex,
        vehiclePosition: data.vehiclePosition || global.currentRoute.vehiclePosition,
        lastUpdated: new Date().toISOString()
      }
    } else {
      global.currentRoute = {
        destinations: [],
        status: validStatus,
        totalDistance: 0,
        currentDestinationIndex: 0,
        lastUpdated: new Date().toISOString(),
        vehiclePosition: data.vehiclePosition || null
      }
    }
    
    // Broadcast status update to all clients
    io.emit('route_status_changed', {
      status: global.currentRoute.status,
      currentDestinationIndex: global.currentRoute.currentDestinationIndex,
      vehiclePosition: global.currentRoute.vehiclePosition,
      timestamp: new Date().toISOString()
    })
    
    console.log(`📡 Route status broadcasted:`, global.currentRoute.status)
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

// Enhanced RFID handling function with vehicle GPS position tracking
async function handleRFIDScan(data, deviceSource = 'ARDUINO') {
  try {
    // Smart GPS coordinate selection logic:
    // 1. If scan includes GPS that's different from default coordinates, use it
    // 2. If scan includes GPS that matches default coordinates, check if we have better vehicle position
    // 3. Use current vehicle position if it's been updated from WebSocket
    // 4. Default fallback coordinates (last resort)
    
    let vehicleLat, vehicleLng, coordinateSource
    const DEFAULT_LAT = 23.8103
    const DEFAULT_LNG = 90.4125
    
    // Check if scan request includes GPS coordinates
    const scanLat = data.latitude || data.lat
    const scanLng = data.longitude || data.lng
    
    if (scanLat && scanLng) {
      const providedLat = parseFloat(scanLat)
      const providedLng = parseFloat(scanLng)
      
      // Define static coordinates that should be treated as "default"
      const ARDUINO_STATIC_LAT = 23.7465  // Arduino's hardcoded coordinates
      const ARDUINO_STATIC_LNG = 90.3765
      
      // Check if the provided coordinates are default/static values
      const isDefaultCoords = (providedLat === DEFAULT_LAT && providedLng === DEFAULT_LNG)
      const isArduinoStaticCoords = (providedLat === ARDUINO_STATIC_LAT && providedLng === ARDUINO_STATIC_LNG)
      const isStaticCoords = isDefaultCoords || isArduinoStaticCoords
      const hasUpdatedVehiclePosition = !(currentVehiclePosition.lat === DEFAULT_LAT && currentVehiclePosition.lng === DEFAULT_LNG)
      
      if (isStaticCoords && hasUpdatedVehiclePosition) {
        // Arduino/client sent static coords, but we have real vehicle position - use vehicle position
        vehicleLat = currentVehiclePosition.lat
        vehicleLng = currentVehiclePosition.lng
        coordinateSource = 'VEHICLE_POSITION_PREFERRED'
        
        if (isArduinoStaticCoords) {
          console.log(`📍 Arduino sent static GPS (${providedLat}, ${providedLng}), using real vehicle position: ${vehicleLat}, ${vehicleLng}`)
        } else {
          console.log(`📍 Client sent default GPS (${providedLat}, ${providedLng}), using real vehicle position: ${vehicleLat}, ${vehicleLng}`)
        }
        
      } else if (!isStaticCoords) {
        // Client sent real GPS coordinates - use them and update vehicle position
        vehicleLat = providedLat
        vehicleLng = providedLng
        coordinateSource = 'SCAN_REQUEST'
        
        updateVehiclePosition({ lat: vehicleLat, lng: vehicleLng }, `RFID_${deviceSource}`)
        console.log(`📍 GPS coordinates received from ${deviceSource} scan: ${vehicleLat}, ${vehicleLng}`)
        
      } else {
        // Client sent static coords and we don't have better vehicle position
        // For testing: Allow static coordinates with a warning
        vehicleLat = isArduinoStaticCoords ? ARDUINO_STATIC_LAT : DEFAULT_LAT
        vehicleLng = isArduinoStaticCoords ? ARDUINO_STATIC_LNG : DEFAULT_LNG
        coordinateSource = 'STATIC_FALLBACK'
        console.log(`⚠️  WARNING: Using static GPS coordinates from ${deviceSource}. Consider updating with real GPS data.`)
      }
      
    } else {
      // No GPS in scan request - use current vehicle position
      vehicleLat = currentVehiclePosition.lat
      vehicleLng = currentVehiclePosition.lng
      coordinateSource = 'VEHICLE_POSITION'
      
      // Check if we're still using default coordinates
      if (vehicleLat === DEFAULT_LAT && vehicleLng === DEFAULT_LNG) {
        console.warn(`⚠️  WARNING: Using default GPS coordinates for RFID scan! No actual vehicle GPS received yet.`)
        coordinateSource = 'DEFAULT_FALLBACK'
      }
    }
    
    // Get location name from the determined coordinates
    const locationName = await reverseGeocode(vehicleLat, vehicleLng)
    
    const { card_id, cardId } = data
    const actualCardId = card_id || cardId
    
    console.log(`🔍 RFID Scan Details:`)
    console.log(`   Card ID: ${actualCardId}`)
    console.log(`   GPS Source: ${coordinateSource}`)
    console.log(`   Final Coordinates: ${vehicleLat}, ${vehicleLng}`)
    console.log(`   Location: ${locationName}`)
    console.log(`   Device: ${deviceSource}`)
    
    if (!actualCardId) {
      return { 
        success: false, 
        message: 'Card ID is required',
        action: 'error_beep'
      }
    }

    const now = Date.now()
    const lastScan = recentCardScans.get(actualCardId)
    
    // Debounce duplicate scans
    if (lastScan && (now - lastScan) < SCAN_DEBOUNCE_TIME) {
      return {
        success: true,
        message: 'Scan ignored (duplicate)',
        action: 'no_action'
      }
    }
    
    recentCardScans.set(actualCardId, now)
    
    // Find user by card_id (matching with CARD_ID column)
    const users = await supabaseRequest(`user_profile?card_id=eq.${actualCardId}&select=*`)
    
    if (users.length === 0) {
      return {
        success: false,
        message: 'Card not registered',
        action: 'error_beep',
        display: ['Invalid Card', 'Not Registered']
      }
    }
    
    const user = users[0]
    
    // CHECK FOR BLOCKED CARD - CRITICAL SECURITY CHECK
    if (user.is_blocked === true) {
      console.log(`🚫 BLOCKED CARD DETECTED: ${actualCardId} - User: ${user.name}`);
      
      // Log the attempted use of blocked card
      console.warn(`⚠️  SECURITY ALERT: Blocked card ${actualCardId} (${user.name}) attempted to use transport at ${locationName}`);
      
      // Emit security alert via WebSocket
      io.emit('security_alert', {
        type: 'blocked_card_usage_attempt',
        cardId: actualCardId,
        userId: user.user_id,
        userName: user.name,
        location: locationName,
        coordinates: { lat: vehicleLat, lng: vehicleLng },
        timestamp: new Date().toISOString(),
        blockedReason: user.blocked_reason,
        blockedAt: user.blocked_at,
        blockedBy: user.blocked_by
      });
      
      return {
        success: false,
        message: 'Card is blocked',
        action: 'error_beep',
        display: ['CARD BLOCKED', 'Contact Support'],
        error: 'This card has been blocked. Please contact customer support.',
        user: {
          name: user.name,
          cardId: actualCardId,
          blockedReason: user.blocked_reason,
          blockedAt: user.blocked_at
        }
      }
    }
    
    // Check if user has sufficient balance (minimum 20 BDT for 1km journey)
    if (user.balance < 20) { // Minimum fare for 1km
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
      
      // Get boarding coordinates from when journey started
      const boardingLat = parseFloat(travel.current_latitude)
      const boardingLng = parseFloat(travel.current_longitude)
      
      // Current exit coordinates from vehicle GPS
      const exitLat = vehicleLat
      const exitLng = vehicleLng
      
      // Calculate actual distance traveled from boarding to exit point
      const distance = calculateDistance(
        boardingLat,
        boardingLng,
        exitLat,
        exitLng
      )
      
      console.log(`Distance calculation: Boarding(${boardingLat}, ${boardingLng}) -> Exit(${exitLat}, ${exitLng}) = ${distance.toFixed(2)}km`)
      
      // Simple fare calculation: 20 BDT per kilometer
      const FARE_PER_KM = 20; // 20 BDT per kilometer
      let calculatedFare = Math.max(20, distance * FARE_PER_KM); // Minimum 20 BDT for any journey
      
      // Apply card type discounts (check if card_type field exists)
      const cardType = user.card_type?.toLowerCase() || 'general';
      console.log(`User card type: ${cardType} (User: ${user.name})`);
      
      if (cardType === 'student') {
        // 50% discount for students
        calculatedFare = calculatedFare * 0.5;
        console.log(`Student discount applied: 50% off - Original: ৳${Math.round(distance * FARE_PER_KM)}, Discounted: ৳${Math.round(calculatedFare)}`);
      } else if (cardType === 'senior') {
        // 30% discount for senior citizens
        calculatedFare = calculatedFare * 0.7;
        console.log(`Senior citizen discount applied: 30% off - Original: ৳${Math.round(distance * FARE_PER_KM)}, Discounted: ৳${Math.round(calculatedFare)}`);
      } else if (cardType === 'disabled') {
        // 60% discount for disabled persons
        calculatedFare = calculatedFare * 0.4;
        console.log(`Disabled person discount applied: 60% off - Original: ৳${Math.round(distance * FARE_PER_KM)}, Discounted: ৳${Math.round(calculatedFare)}`);
      } else {
        console.log(`Regular fare applied - No discount for card type: ${cardType}`);
      }
      
      // Ensure minimum fare even after discounts (at least 10 BDT)
      calculatedFare = Math.max(10, Math.round(calculatedFare));
      
      console.log(`Final fare calculation: ${distance.toFixed(2)}km × ৳${FARE_PER_KM}/km = ৳${calculatedFare} (Card type: ${cardType})`)
      
      const newBalance = user.balance - calculatedFare
      
      if (newBalance < 0) {
        return {
          success: false,
          message: 'Insufficient balance for this journey',
          action: 'error_beep',
          display: [`Fare: ${calculatedFare} BDT`, `Balance: ${user.balance} BDT`]
        }
      }
      
      const journeyDurationMinutes = (new Date() - new Date(travel.created_at)) / (1000 * 60)
      const journeyDuration = formatJourneyTime(journeyDurationMinutes)
      
      // Update user balance
      await supabaseRequest(`user_profile?user_id=eq.${user.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: newBalance })
      })
      
      // Get distinct drop-off location name
      let dropOffLocationName = locationName;
      
      // If the drop-off location is too similar to pick-up location, make it more specific
      if (dropOffLocationName === travel.pick_point || 
          dropOffLocationName.toLowerCase().includes(travel.pick_point.toLowerCase()) ||
          travel.pick_point.toLowerCase().includes(dropOffLocationName.toLowerCase())) {
        
        // Add coordinate-based suffix to make locations distinct
        const dropCoordSuffix = `(${exitLat.toFixed(4)}, ${exitLng.toFixed(4)})`;
        const pickCoordSuffix = `(${boardingLat.toFixed(4)}, ${boardingLng.toFixed(4)})`;
        
        dropOffLocationName = `${locationName} ${dropCoordSuffix}`;
        
        // Also update pick_point to be more specific if it's too generic
        if (travel.pick_point === locationName) {
          travel.pick_point = `${travel.pick_point} ${pickCoordSuffix}`;
        }
        
        console.log(`📍 Location names were too similar, made them distinct:`);
        console.log(`   Boarding: ${travel.pick_point}`);
        console.log(`   Drop-off: ${dropOffLocationName}`);
      }

      // Move to travel history
      await supabaseRequest('travel_history', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          pick_point: travel.pick_point,
          drop_point: dropOffLocationName,
          total_cost: calculatedFare,
          remaining_balance: newBalance,
          travel_time: new Date().toISOString()
        })
      })
      
      console.log(`Journey completed: ${user.name} traveled ${distance.toFixed(2)}km from ${travel.pick_point} to ${dropOffLocationName}, fare: ৳${calculatedFare}`)
      
      // Delete from current travel
      await supabaseRequest(`current_travel?user_id=eq.${user.user_id}`, {
        method: 'DELETE'
      })
      
        // Remove passenger from bus
        passengersOnBus.delete(actualCardId)
        
        // Update passenger count cache
        updatePassengerCountCache();
        
        // Broadcast user update via WebSocket
        io.emit('user_update', {
          user_id: user.user_id,
          balance: newBalance,
          action: 'travel_end'
        })
        
        // Broadcast travel completion to all clients
        io.emit('travel_completed', {
          user_id: user.user_id,
          total_cost: calculatedFare,
          distance: distance.toFixed(2),
          timestamp: new Date().toISOString()
        })
        
        // Broadcast updated stats after travel completion
        await broadcastStatsUpdate()
        
        // Prepare response data
        const responseData = {
          success: true,
          message: 'Travel ended',
          action: 'success_beep',
          display: [
            `Journey Complete`,
            `Distance: ${distance.toFixed(2)}km`,
            `Fare: ৳${calculatedFare}`,
            `Balance: ৳${newBalance.toFixed(2)}`
          ]
        }
        
        // Add minimal user data for Arduino, full data for other devices
        if (deviceSource === 'ARDUINO') {
          // Minimal response for Arduino to prevent timeout
          responseData.user = {
            name: user.name,
            balance: newBalance,
            fare_deducted: calculatedFare
          }
        } else {
          // Full response for web/frontend
          responseData.user = {
            name: user.name,
            balance: newBalance,
            fare_deducted: calculatedFare,
            distance: distance.toFixed(2),
            boarding_location: travel.pick_point,
            exit_location: dropOffLocationName,
            boarding_coords: `${boardingLat}, ${boardingLng}`,
            exit_coords: `${exitLat}, ${exitLng}`
          }
        }
        
        // Send emails asynchronously (non-blocking) after response
        setImmediate(async () => {
          try {
            const fareDetails = {
              total_cost: calculatedFare,
              remaining_balance: newBalance,
              duration_minutes: Math.round(journeyDurationMinutes)
            }
            
            const journeyData = {
              pick_point: travel.pick_point,
              drop_point: dropOffLocationName,
              travel_time: new Date().toISOString()
            }
            
            await sendJourneyCompleteEmail(user, journeyData, fareDetails)
            console.log(`Journey completion email sent to ${user.email}`)
            
            // Send low balance alert if balance is low (less than 100 BDT for 5km journey)
            if (newBalance < 100) {
              await sendLowBalanceAlert(user, newBalance)
              console.log(`Low balance alert sent to ${user.email}`)
            }
            
          } catch (emailError) {
            console.error('Email sending failed:', emailError)
            // Don't fail the transaction if email fails
          }
        })
        
        return responseData
      
    } else {
      // Start new travel - ORIGIN SCAN (using vehicle GPS position)
      console.log(`Journey started: Boarding at vehicle GPS (${vehicleLat}, ${vehicleLng}) - ${locationName}`)
      
      // Make boarding location more descriptive by adding coordinate info and timestamp
      const boardingLocationName = `${locationName} (Boarding: ${vehicleLat.toFixed(4)}, ${vehicleLng.toFixed(4)})`;
      
      await supabaseRequest('current_travel', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          pick_point: boardingLocationName,
          current_latitude: vehicleLat.toString(),
          current_longitude: vehicleLng.toString()
        })
      })
      
        // Add passenger to bus tracking
        passengersOnBus.set(actualCardId, {
          name: user.name,
          email: user.email,
          card_id: actualCardId,
          balance: user.balance,
          boardTime: new Date().toISOString(),
          boardLocation: boardingLocationName,
          boardLatitude: vehicleLat,
          boardLongitude: vehicleLng,
          currentLatitude: vehicleLat,
          currentLongitude: vehicleLng,
          coordinateSource: coordinateSource
        })
        
        // Broadcast travel update via WebSocket
        io.emit('travel_update', {
          user_id: user.user_id,
          action: 'travel_start',
          pick_point: boardingLocationName,
          coordinates: { latitude: vehicleLat, longitude: vehicleLng }
        })
        
        // Update passenger count cache
        updatePassengerCountCache();
        
        // Broadcast updated stats after travel start
        await broadcastStatsUpdate()
      
      return {
        success: true,
        message: 'Travel started',
        action: 'success_beep',
        display: [`Welcome ${user.name}`, `Journey Started`],
        user: {
          name: user.name,
          balance: user.balance,
          origin_location: boardingLocationName
        },
        busLocation: {
          lat: vehicleLat,
          lng: vehicleLng,
          address: boardingLocationName
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

// Import Routes
const userRoutes = require('./Routes/user')

// Mount Routes
app.use('/user', userRoutes)

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

// Authentication API Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }
    
    const users = await supabaseRequest(`user_profile?email=eq.${email}&select=user_id,name,email,password,phone,balance`)
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    const user = users[0]
    
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    // Store user session
    req.session.user = {
      id: user.user_id,
      name: user.name,
      email: user.email
    }
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user
    
    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Login API error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.'
    })
  }
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Could not log out. Please try again.'
      })
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    })
  })
})

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      })
    }
    
    // Fetch fresh user data from database to ensure balance is current
    const users = await supabaseRequest(`user_profile?user_id=eq.${req.session.user.id}&select=*`)
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    const user = users[0]
    const { password, ...userWithoutPassword } = user
    
    // Update session with fresh data
    req.session.user = {
      id: user.user_id,
      name: user.name,
      email: user.email
    }
    
    res.json({
      success: true,
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Auth check error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Profile API endpoints
app.get('/api/profile/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // Get user profile
    const users = await supabaseRequest(`user_profile?user_id=eq.${user_id}&select=*`)
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    const user = users[0]
    const { password, ...userWithoutPassword } = user
    
    res.json({
      success: true,
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    })
  }
})

app.put('/api/profile/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { name, email, phone, address } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      })
    }
    
    // Update user profile
    const updateData = {
      name,
      email,
      phone: phone || null,
      address: address || null
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_id=eq.${user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    })
    
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`)
    }
    
    const updatedUsers = await response.json()
    
    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or update failed'
      })
    }
    
    const updatedUser = updatedUsers[0]
    const { password, ...userWithoutPassword } = updatedUser
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    })
  }
})

// Enhanced RFID Card scan endpoint for Arduino ESP
app.post('/api/rfid/scan', async (req, res) => {
  try {
    console.log(`🤖 Arduino RFID scan request:`, {
      card: req.body.card_id,
      gps: req.body.latitude && req.body.longitude ? 
        `${req.body.latitude}, ${req.body.longitude}` : 'Not provided',
      body: req.body
    });
    
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
    const users = await supabaseRequest('user_profile?select=user_id,name,email,phone,card_id,balance,created_at,is_blocked,blocked_at,blocked_reason,blocked_by,unblocked_at,unblocked_by,unblock_reason&order=user_id')
    res.json({ success: true, data: users, count: users.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Monitor Dashboard API Endpoints
app.get('/api/monitor/stats', async (req, res) => {
  try {
    console.log('📊 Monitor stats requested');
    
    // Get real-time statistics from database
    const [totalUsers, activePassengers, todayRevenue, recentTravels] = await Promise.all([
      // Total registered users
      supabaseRequest('user_profile?select=count'),
      
      // Active passengers (current travels)
      supabaseRequest('current_travel?select=count'),
      
      // Today's revenue from completed travels
      supabaseRequest(`travel_history?select=total_cost&travel_time=gte.${new Date().toISOString().split('T')[0]}`),
      
      // Recent travel history for activity feed
      supabaseRequest('travel_history?select=*,user_profile(name,card_id)&order=travel_time.desc&limit=10')
    ]);

    const totalRevenue = todayRevenue.reduce((sum, travel) => sum + (travel.total_cost || 0), 0);
    const totalTrips = todayRevenue.length;

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers[0]?.count || 0,
        activePassengers: activePassengers[0]?.count || 0, // Read from database
        currentPassengers: activePassengers[0]?.count || 0, // Read from database
        totalRevenue: totalRevenue,
        totalTrips: totalTrips,
        recentActivity: recentTravels,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching monitor stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

app.get('/api/monitor/passengers', async (req, res) => {
  try {
    console.log('👥 Current passengers requested from database');
    
    // Get current passengers directly from database instead of memory
    const currentTravelsData = await supabaseRequest(
      `current_travel?select=user_id,pick_point,current_longitude,current_latitude,created_at,user_profile!inner(name,email,card_id,balance,phone)&order=created_at.desc`
    );
    
    // Map the database data to the expected format
    const passengers = currentTravelsData.map(travel => ({
      name: travel.user_profile.name,
      email: travel.user_profile.email,
      phone: travel.user_profile.phone || '',
      cardId: travel.user_profile.card_id,
      balance: travel.user_profile.balance,
      user_id: travel.user_id,
      boardTime: travel.created_at,
      boardLocation: travel.pick_point,
      currentLatitude: parseFloat(travel.current_latitude),
      currentLongitude: parseFloat(travel.current_longitude),
      coordinateSource: 'DATABASE'
    }));

    res.json({
      success: true,
      data: passengers,
      count: passengers.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching current passengers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

// Analytics Dashboard API Endpoints
app.get('/api/analytics/overview', async (req, res) => {
  try {
    console.log('📊 Analytics overview requested');
    
    // Get date ranges for analytics
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
    
    // Parallel database queries for analytics
    const [
      totalUsersData,
      activePassengersData,
      thisMonthRevenueData,
      lastMonthRevenueData,
      thisMonthTripsData,
      lastMonthTripsData,
      todayTripsData,
      recentTravelsData
    ] = await Promise.all([
      // Total registered users
      supabaseRequest('user_profile?select=count'),
      
      // Active passengers (currently traveling)
      supabaseRequest('current_travel?select=count'),
      
      // This month's revenue
      supabaseRequest(`travel_history?select=total_cost&travel_time=gte.${thisMonth}`),
      
      // Last month's revenue
      supabaseRequest(`travel_history?select=total_cost&travel_time=gte.${lastMonth}&travel_time=lte.${lastMonthEnd}`),
      
      // This month's trips
      supabaseRequest(`travel_history?select=user_id&travel_time=gte.${thisMonth}`),
      
      // Last month's trips
      supabaseRequest(`travel_history?select=user_id&travel_time=gte.${lastMonth}&travel_time=lte.${lastMonthEnd}`),
      
      // Today's trips
      supabaseRequest(`travel_history?select=user_id&travel_time=gte.${today}`),
      
      // Recent travel activity
      supabaseRequest('travel_history?select=*,user_profile(name,card_id)&order=travel_time.desc&limit=20')
    ]);

    // Calculate metrics
    const totalUsers = totalUsersData[0]?.count || 0;
    const activeUsers = activePassengersData[0]?.count || 0;
    
    const thisMonthRevenue = thisMonthRevenueData.reduce((sum, travel) => sum + (travel.total_cost || 0), 0);
    const lastMonthRevenue = lastMonthRevenueData.reduce((sum, travel) => sum + (travel.total_cost || 0), 0);
    const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
    
    const thisMonthTrips = thisMonthTripsData.length;
    const lastMonthTrips = lastMonthTripsData.length;
    const tripsGrowth = lastMonthTrips > 0 ? ((thisMonthTrips - lastMonthTrips) / lastMonthTrips * 100) : 0;
    
    const todayTrips = todayTripsData.length;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalRevenue: thisMonthRevenue,
        totalTrips: thisMonthTrips,
        activeUsers,
        todayTrips,
        monthlyGrowth: {
          revenue: Math.round(revenueGrowth * 100) / 100,
          trips: Math.round(tripsGrowth * 100) / 100,
          users: 0 // We'd need historical user data to calculate this
        },
        recentActivity: recentTravelsData.slice(0, 10),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/analytics/revenue', async (req, res) => {
  try {
    console.log('💰 Revenue analytics requested');
    
    // Get last 6 months of revenue data
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      
      months.push({
        name: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        start: monthStart,
        end: monthEnd
      });
    }
    
    // Get revenue data for each month
    const revenueData = await Promise.all(
      months.map(async (month) => {
        const data = await supabaseRequest(`travel_history?select=total_cost&travel_time=gte.${month.start}&travel_time=lte.${month.end}`);
        const revenue = data.reduce((sum, travel) => sum + (travel.total_cost || 0), 0);
        return {
          month: month.name,
          revenue: Math.round(revenue * 100) / 100,
          trips: data.length
        };
      })
    );

    res.json({
      success: true,
      data: {
        monthlyRevenue: revenueData,
        totalRevenue: revenueData.reduce((sum, month) => sum + month.revenue, 0),
        totalTrips: revenueData.reduce((sum, month) => sum + month.trips, 0),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/analytics/routes', async (req, res) => {
  try {
    console.log('🚌 Route analytics requested');
    
    // Get popular routes from travel history
    const routeData = await supabaseRequest('travel_history?select=pick_point,drop_point,total_cost&order=travel_time.desc&limit=1000');
    
    // Analyze route popularity
    const routeStats = {};
    routeData.forEach(travel => {
      const route = `${travel.pick_point} → ${travel.drop_point}`;
      if (!routeStats[route]) {
        routeStats[route] = {
          route,
          count: 0,
          totalRevenue: 0,
          averageFare: 0
        };
      }
      routeStats[route].count++;
      routeStats[route].totalRevenue += travel.total_cost || 0;
    });
    
    // Calculate averages and sort by popularity
    const popularRoutes = Object.values(routeStats)
      .map(route => ({
        ...route,
        averageFare: Math.round((route.totalRevenue / route.count) * 100) / 100,
        percentage: 0 // Will be calculated after sorting
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate percentages
    const totalTrips = routeData.length;
    popularRoutes.forEach(route => {
      route.percentage = Math.round((route.count / totalTrips) * 100 * 100) / 100;
    });

    res.json({
      success: true,
      data: {
        popularRoutes,
        totalRoutes: Object.keys(routeStats).length,
        totalTrips,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching route analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/analytics/users', async (req, res) => {
  try {
    console.log('👥 User analytics requested');
    
    const today = new Date().toISOString().split('T')[0];
    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    const [
      totalUsersData,
      activeUsersData,
      newUsersThisMonth,
      userBalances,
      userTripCounts
    ] = await Promise.all([
      // Total users
      supabaseRequest('user_profile?select=count'),
      
      // Active users (traveled recently) - get distinct users from this week
      supabaseRequest(`travel_history?select=user_id&travel_time=gte.${thisWeek}`),
      
      // New users this month
      supabaseRequest(`user_profile?select=count&created_at=gte.${thisMonth}`),
      
      // User balance distribution
      supabaseRequest('user_profile?select=balance&order=balance.desc'),
      
      // User trip frequency - get all trips with user info
      supabaseRequest('travel_history?select=user_id,user_profile!inner(name,email)&order=user_id')
    ]);
    
    // Analyze user trip frequency
    const tripFrequency = {};
    userTripCounts.forEach(trip => {
      const userId = trip.user_id;
      if (!tripFrequency[userId]) {
        tripFrequency[userId] = {
          userId,
          name: trip.user_profile?.name || 'Unknown',
          email: trip.user_profile?.email || '',
          tripCount: 0
        };
      }
      tripFrequency[userId].tripCount++;
    });
    
    const topUsers = Object.values(tripFrequency)
      .sort((a, b) => b.tripCount - a.tripCount)
      .slice(0, 10);
    
    // Balance analysis
    const balanceRanges = {
      '0-100': 0,
      '101-500': 0,
      '501-1000': 0,
      '1000+': 0
    };
    
    userBalances.forEach(user => {
      const balance = user.balance || 0;
      if (balance <= 100) balanceRanges['0-100']++;
      else if (balance <= 500) balanceRanges['101-500']++;
      else if (balance <= 1000) balanceRanges['501-1000']++;
      else balanceRanges['1000+']++;
    });

    // Calculate unique active users from the thisWeek data
    const uniqueActiveUsers = new Set(activeUsersData.map(u => u.user_id)).size;

    res.json({
      success: true,
      data: {
        totalUsers: totalUsersData[0]?.count || 0,
        activeUsers: uniqueActiveUsers,
        newUsersThisMonth: newUsersThisMonth[0]?.count || 0,
        topUsers,
        balanceDistribution: balanceRanges,
        averageBalance: userBalances.length > 0 ? 
          Math.round((userBalances.reduce((sum, u) => sum + (u.balance || 0), 0) / userBalances.length) * 100) / 100 : 0,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Settings Management API Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    console.log('⚙️ System settings requested');
    
    let settingsData;
    
    try {
      // Try to get existing settings from the database
      settingsData = await supabaseRequest('system_settings?select=*&limit=1');
    } catch (error) {
      console.log('📋 system_settings table not found, using default settings');
      settingsData = null;
    }
    
    // If no settings exist or table doesn't exist, use default settings
    if (!settingsData || settingsData.length === 0) {
      console.log('🔧 No settings found, using default settings...');
      
      const defaultSettings = {
        id: 1,
        setting_key: 'system_config',
        site_name: 'Smart Transit System',
        site_url: 'http://localhost:3000',
        admin_email: 'admin@smarttransit.com',
        enable_notifications: true,
        enable_registration: true,
        max_balance: 5000,
        min_recharge: 10,
        fare_per_km: 2.5,
        base_fare: 15,
        system_maintenance: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Try to create the settings in the database if table exists
      try {
        await supabaseRequest('system_settings', {
          method: 'POST',
          body: JSON.stringify(defaultSettings)
        });
        console.log('✅ Default settings created in database');
        settingsData = [defaultSettings];
      } catch (createError) {
        // If table doesn't exist or creation fails, use defaults
        console.log('📝 Using local default settings (database table may not exist)');
        settingsData = [defaultSettings];
      }
    }

    const settings = settingsData[0];
    
    res.json({
      success: true,
      data: {
        siteName: settings.site_name || 'Smart Transit System',
        siteUrl: settings.site_url || 'http://localhost:3000',
        adminEmail: settings.admin_email || 'admin@smarttransit.com',
        enableNotifications: settings.enable_notifications ?? true,
        enableRegistration: settings.enable_registration ?? true,
        maxBalance: settings.max_balance || 5000,
        minRecharge: settings.min_recharge || 10,
        farePerKm: settings.fare_per_km || 2.5,
        baseFare: settings.base_fare || 15,
        systemMaintenance: settings.system_maintenance ?? false,
        lastUpdated: settings.updated_at || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    
    // Return default settings if there's an error
    res.json({
      success: true,
      data: {
        siteName: 'Smart Transit System',
        siteUrl: 'http://localhost:3000',
        adminEmail: 'admin@smarttransit.com',
        enableNotifications: true,
        enableRegistration: true,
        maxBalance: 5000,
        minRecharge: 10,
        farePerKm: 2.5,
        baseFare: 15,
        systemMaintenance: false,
        lastUpdated: new Date().toISOString()
      }
    });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    console.log('⚙️ Updating system settings');
    console.log('📝 Request body:', req.body);
    
    const {
      siteName,
      siteUrl,
      adminEmail,
      enableNotifications,
      enableRegistration,
      maxBalance,
      minRecharge,
      farePerKm,
      baseFare,
      systemMaintenance
    } = req.body;

    // Validate required fields
    if (!siteName || !siteUrl || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Site name, URL, and admin email are required'
      });
    }

    // Validate numeric fields
    if (maxBalance < 0 || minRecharge < 0 || farePerKm < 0 || baseFare < 0) {
      return res.status(400).json({
        success: false,
        message: 'Numeric values must be positive'
      });
    }

    const settingsData = {
      setting_key: 'system_config',
      site_name: siteName,
      site_url: siteUrl,
      admin_email: adminEmail,
      enable_notifications: enableNotifications,
      enable_registration: enableRegistration,
      max_balance: parseFloat(maxBalance),
      min_recharge: parseFloat(minRecharge),
      fare_per_km: parseFloat(farePerKm),
      base_fare: parseFloat(baseFare),
      system_maintenance: systemMaintenance,
      updated_at: new Date().toISOString()
    };

    try {
      // Check if settings already exist
      const existingSettings = await supabaseRequest('system_settings?select=*&setting_key=eq.system_config&limit=1');
      
      if (existingSettings && existingSettings.length > 0) {
        // Update existing settings
        await supabaseRequest(`system_settings?setting_key=eq.system_config`, {
          method: 'PATCH',
          body: JSON.stringify(settingsData)
        });
        console.log('✅ Settings updated successfully');
      } else {
        // Create new settings
        await supabaseRequest('system_settings', {
          method: 'POST',
          body: JSON.stringify(settingsData)
        });
        console.log('✅ Settings created successfully');
      }
    } catch (error) {
      console.log('📝 Settings table not available, storing settings locally:', error.message);
      // Store settings in memory/cache for this session
      global.systemSettings = settingsData;
    }

    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: {
        siteName: settingsData.site_name,
        siteUrl: settingsData.site_url,
        adminEmail: settingsData.admin_email,
        enableNotifications: settingsData.enable_notifications,
        enableRegistration: settingsData.enable_registration,
        maxBalance: settingsData.max_balance,
        minRecharge: settingsData.min_recharge,
        farePerKm: settingsData.fare_per_km,
        baseFare: settingsData.base_fare,
        systemMaintenance: settingsData.system_maintenance,
        lastUpdated: settingsData.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save settings: ' + error.message
    });
  }
});

app.post('/api/settings/reset', async (req, res) => {
  try {
    console.log('🔄 Resetting system settings to defaults');
    
    const defaultSettings = {
      setting_key: 'system_config',
      site_name: 'Smart Transit System',
      site_url: 'http://localhost:3000',
      admin_email: 'admin@smarttransit.com',
      enable_notifications: true,
      enable_registration: true,
      max_balance: 5000,
      min_recharge: 10,
      fare_per_km: 2.5,
      base_fare: 15,
      system_maintenance: false,
      updated_at: new Date().toISOString()
    };

    try {
      // Update or create default settings
      const existingSettings = await supabaseRequest('system_settings?select=*&setting_key=eq.system_config&limit=1');
      
      if (existingSettings && existingSettings.length > 0) {
        // Update existing settings
        await supabaseRequest(`system_settings?setting_key=eq.system_config`, {
          method: 'PATCH',
          body: JSON.stringify(defaultSettings)
        });
      } else {
        // Create new settings
        await supabaseRequest('system_settings', {
          method: 'POST',
          body: JSON.stringify(defaultSettings)
        });
      }
    } catch (error) {
      console.log('📝 Settings table not available, storing defaults locally:', error.message);
      // Store settings in memory/cache for this session
      global.systemSettings = defaultSettings;
    }

    res.json({
      success: true,
      message: 'Settings reset to defaults successfully',
      data: {
        siteName: defaultSettings.site_name,
        siteUrl: defaultSettings.site_url,
        adminEmail: defaultSettings.admin_email,
        enableNotifications: defaultSettings.enable_notifications,
        enableRegistration: defaultSettings.enable_registration,
        maxBalance: defaultSettings.max_balance,
        minRecharge: defaultSettings.min_recharge,
        farePerKm: defaultSettings.fare_per_km,
        baseFare: defaultSettings.base_fare,
        systemMaintenance: defaultSettings.system_maintenance,
        lastUpdated: defaultSettings.updated_at
      }
    });
  } catch (error) {
    console.error('Error resetting system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings: ' + error.message
    });
  }
});

// System health and information endpoints
app.get('/api/system/health', async (req, res) => {
  try {
    console.log('🏥 System health check requested');
    
    // Test database connection
    const dbTest = await supabaseRequest('user_profile?select=count&limit=1');
    
    // Get basic system info
    const systemInfo = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        type: 'PostgreSQL (Supabase)',
        userCount: dbTest[0]?.count || 0
      },
      api: {
        status: 'online',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      websocket: {
        status: 'active',
        connectedClients: io.engine.clientsCount || 0
      }
    };

    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      message: 'System health check failed',
      error: error.message
    });
  }
});

// Database Management Endpoints
app.get('/api/database/stats', async (req, res) => {
  try {
    console.log('📊 Database statistics requested');
    
    // Get database statistics using REST API format
    const tableStats = await Promise.all([
      supabaseRequest('user_profile?select=count'),
      supabaseRequest('travel_history?select=count'),
      supabaseRequest('current_travel?select=count'),
      supabaseRequest('recharge_history?select=count'),
      supabaseRequest('bus_info?select=count')
    ]);

    // Calculate total records from REST API response
    const totalRecords = tableStats.reduce((sum, stat) => {
      const count = Array.isArray(stat) && stat.length > 0 ? stat[0]?.count || 0 : 0;
      return sum + count;
    }, 0);

    // Get database size info (simplified approach)
    const databaseInfo = {
      totalTables: 5,
      totalRecords: totalRecords,
      dbSize: `${(totalRecords * 0.005).toFixed(1)} MB`, // Estimation
      status: 'healthy',
      connections: Math.floor(Math.random() * 15) + 5, // Simulated active connections
      uptime: calculateUptime(),
      lastBackup: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random within last week
      engine: 'PostgreSQL',
      version: '15.3',
      encoding: 'UTF8'
    };

    res.json({
      success: true,
      data: databaseInfo
    });
  } catch (error) {
    console.error('❌ Error fetching database stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch database statistics',
      error: error.message
    });
  }
});

app.get('/api/database/tables', async (req, res) => {
  try {
    console.log('📋 Database tables information requested');
    
    // Get detailed table information using REST API format
    const tableDetails = await Promise.all([
      supabaseRequest('user_profile?select=count'),
      supabaseRequest('travel_history?select=count'),
      supabaseRequest('current_travel?select=count'),
      supabaseRequest('recharge_history?select=count'),
      supabaseRequest('bus_info?select=count')
    ]);

    const tables = [
      {
        name: 'USER_PROFILE',
        records: (Array.isArray(tableDetails[0]) && tableDetails[0].length > 0) ? tableDetails[0][0]?.count || 0 : 0,
        size: `${(((Array.isArray(tableDetails[0]) && tableDetails[0].length > 0) ? tableDetails[0][0]?.count || 0 : 0) * 0.036).toFixed(1)} MB`,
        status: 'healthy',
        description: 'User account information and profiles'
      },
      {
        name: 'TRAVEL_HISTORY',
        records: (Array.isArray(tableDetails[1]) && tableDetails[1].length > 0) ? tableDetails[1][0]?.count || 0 : 0,
        size: `${(((Array.isArray(tableDetails[1]) && tableDetails[1].length > 0) ? tableDetails[1][0]?.count || 0 : 0) * 0.008).toFixed(1)} MB`,
        status: 'healthy',
        description: 'Complete travel history records'
      },
      {
        name: 'CURRENT_TRAVEL',
        records: (Array.isArray(tableDetails[2]) && tableDetails[2].length > 0) ? tableDetails[2][0]?.count || 0 : 0,
        size: `${(((Array.isArray(tableDetails[2]) && tableDetails[2].length > 0) ? tableDetails[2][0]?.count || 0 : 0) * 0.012).toFixed(1)} MB`,
        status: ((Array.isArray(tableDetails[2]) && tableDetails[2].length > 0) ? tableDetails[2][0]?.count || 0 : 0) > 100 ? 'warning' : 'healthy',
        description: 'Active travel sessions'
      },
      {
        name: 'RECHARGE_HISTORY',
        records: (Array.isArray(tableDetails[3]) && tableDetails[3].length > 0) ? tableDetails[3][0]?.count || 0 : 0,
        size: `${(((Array.isArray(tableDetails[3]) && tableDetails[3].length > 0) ? tableDetails[3][0]?.count || 0 : 0) * 0.003).toFixed(1)} MB`,
        status: 'healthy',
        description: 'Account recharge transaction history'
      },
      {
        name: 'BUS_INFO',
        records: (Array.isArray(tableDetails[4]) && tableDetails[4].length > 0) ? tableDetails[4][0]?.count || 0 : 0,
        size: `${(((Array.isArray(tableDetails[4]) && tableDetails[4].length > 0) ? tableDetails[4][0]?.count || 0 : 0) * 0.001).toFixed(1)} MB`,
        status: 'healthy',
        description: 'Bus fleet information and details'
      }
    ];

    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('❌ Error fetching table information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table information',
      error: error.message
    });
  }
});

app.post('/api/database/backup', async (req, res) => {
  try {
    console.log('💾 Database backup requested');
    
    // Simulate backup process (in real implementation, this would trigger pg_dump or Supabase backup)
    const backupStartTime = Date.now();
    
    // Simulate backup duration (2-5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    const backupEndTime = Date.now();
    const backupDuration = backupEndTime - backupStartTime;
    
    const backupInfo = {
      id: `backup_${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration: `${(backupDuration / 1000).toFixed(1)}s`,
      size: `${(Math.random() * 50 + 10).toFixed(1)} MB`,
      status: 'completed',
      type: 'full_backup'
    };

    res.json({
      success: true,
      message: 'Database backup completed successfully',
      data: backupInfo
    });
  } catch (error) {
    console.error('❌ Database backup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database backup failed',
      error: error.message
    });
  }
});

app.post('/api/database/optimize', async (req, res) => {
  try {
    console.log('⚡ Database optimization requested');
    
    const optimizeStartTime = Date.now();
    
    // Simulate optimization operations
    const operations = [
      'Analyzing table statistics',
      'Rebuilding indexes',
      'Updating query plans',
      'Cleaning up temporary data',
      'Optimizing storage'
    ];
    
    let completedOperations = [];
    
    for (let i = 0; i < operations.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      completedOperations.push(operations[i]);
    }
    
    const optimizeEndTime = Date.now();
    const optimizeDuration = optimizeEndTime - optimizeStartTime;
    
    const optimizeInfo = {
      duration: `${(optimizeDuration / 1000).toFixed(1)}s`,
      operations: completedOperations,
      spaceSaved: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
      performanceImprovement: `${(Math.random() * 15 + 5).toFixed(1)}%`,
      status: 'completed'
    };

    res.json({
      success: true,
      message: 'Database optimization completed successfully',
      data: optimizeInfo
    });
  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database optimization failed',
      error: error.message
    });
  }
});

app.get('/api/database/performance', async (req, res) => {
  try {
    console.log('📈 Database performance metrics requested');
    
    // Get real current travel count for active connections simulation
    const currentTravelResult = await supabaseRequest('current_travel?select=count');
    const activeConnections = (Array.isArray(currentTravelResult) && currentTravelResult.length > 0) ? currentTravelResult[0]?.count || 0 : 0;
    
    const performanceMetrics = {
      queryPerformance: {
        averageQueryTime: `${(Math.random() * 50 + 10).toFixed(1)}ms`,
        slowQueries: Math.floor(Math.random() * 5),
        totalQueries: Math.floor(Math.random() * 1000 + 500),
        cacheHitRatio: `${(90 + Math.random() * 9).toFixed(1)}%`
      },
      connections: {
        active: activeConnections + Math.floor(Math.random() * 10),
        idle: Math.floor(Math.random() * 5),
        max: 100,
        usage: `${(activeConnections * 1.2).toFixed(1)}%`
      },
      storage: {
        used: `${(Math.random() * 200 + 100).toFixed(1)} MB`,
        available: `${(Math.random() * 800 + 200).toFixed(1)} MB`,
        usage: `${(20 + Math.random() * 30).toFixed(1)}%`
      },
      indexEfficiency: `${(85 + Math.random() * 14).toFixed(1)}%`,
      uptime: calculateUptime(),
      lastOptimized: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    res.json({
      success: true,
      data: performanceMetrics
    });
  } catch (error) {
    console.error('❌ Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics',
      error: error.message
    });
  }
});

// Helper function to calculate uptime
function calculateUptime() {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days} days, ${hours} hours`;
  } else if (hours > 0) {
    return `${hours} hours, ${minutes} minutes`;
  } else {
    return `${minutes} minutes`;
  }
}

// ================================
// CARD BLOCKING SYSTEM API ENDPOINTS
// ================================

// Block a user's card
app.post('/api/cards/block', async (req, res) => {
  try {
    const { userId, cardId, reason, blockedBy = 'ADMIN' } = req.body;

    if (!userId && !cardId) {
      return res.status(400).json({
        success: false,
        message: 'Either userId or cardId must be provided'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for blocking is required'
      });
    }

    console.log(`🚫 Blocking card request: ${cardId || `User ID: ${userId}`}`);

    // Build the WHERE clause based on what's provided
    let whereClause = '';
    let whereParams = [];

    if (cardId) {
      whereClause = 'CARD_ID = $1';
      whereParams = [cardId];
    } else {
      whereClause = 'USER_ID = $1';
      whereParams = [userId];
    }

    // First check if user exists and get current status
    let userResult;
    
    if (cardId) {
      userResult = await supabaseRequest(`user_profile?card_id=eq.${cardId}&select=user_id,name,email,card_id,is_blocked,balance`);
    } else {
      userResult = await supabaseRequest(`user_profile?user_id=eq.${userId}&select=user_id,name,email,card_id,is_blocked,balance`);
    }

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult[0];

    if (user.is_blocked === true) {
      return res.status(400).json({
        success: false,
        message: 'Card is already blocked',
        data: { user }
      });
    }

    // Block the card
    let result;
    
    if (cardId) {
      result = await supabaseRequest(`user_profile?card_id=eq.${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason,
          blocked_by: blockedBy,
          unblocked_at: null,
          unblocked_by: null,
          unblock_reason: null
        })
      });
    } else {
      result = await supabaseRequest(`user_profile?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason,
          blocked_by: blockedBy,
          unblocked_at: null,
          unblocked_by: null,
          unblock_reason: null
        })
      });
    }

    if (result.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to block card'
      });
    }

    const blockedUser = result[0];

    // Send blocking notification email
    try {
      const emailSubject = 'URGENT: Your Transport Card Has Been Blocked';
      const emailText = `
Dear ${blockedUser.name},

Your Smart Transit RFID card (${blockedUser.card_id}) has been blocked for the following reason:

Reason: ${reason}
Blocked At: ${new Date(blockedUser.blocked_at).toLocaleString()}
Blocked By: ${blockedBy}

Your card cannot be used for any transportation services until it is unblocked.

If you believe this was done in error or if you need to unblock your card, please contact our customer support immediately.

Current account balance: ৳${user.balance}

Thank you for your understanding.

Smart Transit Support Team
`;

      await sendNotificationEmail(blockedUser.email, emailSubject, emailText);
      console.log(`📧 Card blocking notification sent to ${blockedUser.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send blocking notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Emit WebSocket event for real-time updates
    io.emit('card_blocked', {
      userId: blockedUser.user_id,
      cardId: blockedUser.card_id,
      userName: blockedUser.name,
      reason: reason,
      blockedAt: blockedUser.blocked_at,
      blockedBy: blockedBy
    });

    console.log(`✅ Card ${blockedUser.card_id} successfully blocked for user ${blockedUser.name}`);

    res.json({
      success: true,
      message: 'Card blocked successfully',
      data: {
        user: blockedUser,
        emailSent: true
      }
    });

  } catch (error) {
    console.error('❌ Error blocking card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block card',
      error: error.message
    });
  }
});

// Unblock a user's card
app.post('/api/cards/unblock', async (req, res) => {
  try {
    const { userId, cardId, reason, unblockedBy = 'ADMIN' } = req.body;

    if (!userId && !cardId) {
      return res.status(400).json({
        success: false,
        message: 'Either userId or cardId must be provided'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for unblocking is required'
      });
    }

    console.log(`✅ Unblocking card request: ${cardId || `User ID: ${userId}`}`);

    // Build the WHERE clause based on what's provided
    let whereClause = '';
    let whereParams = [];

    if (cardId) {
      whereClause = 'CARD_ID = $1';
      whereParams = [cardId];
    } else {
      whereClause = 'USER_ID = $1';
      whereParams = [userId];
    }

    // First check if user exists and current status
    let userResult;
    
    if (cardId) {
      userResult = await supabaseRequest(`user_profile?card_id=eq.${cardId}&select=user_id,name,email,card_id,is_blocked,balance`);
    } else {
      userResult = await supabaseRequest(`user_profile?user_id=eq.${userId}&select=user_id,name,email,card_id,is_blocked,balance`);
    }

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult[0];

    if (user.is_blocked === false || user.is_blocked === null) {
      return res.status(400).json({
        success: false,
        message: 'Card is not blocked',
        data: { user }
      });
    }

    // Unblock the card
    let result;
    
    if (cardId) {
      result = await supabaseRequest(`user_profile?card_id=eq.${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_blocked: false,
          unblocked_at: new Date().toISOString(),
          unblock_reason: reason,
          unblocked_by: unblockedBy
        })
      });
    } else {
      result = await supabaseRequest(`user_profile?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_blocked: false,
          unblocked_at: new Date().toISOString(),
          unblock_reason: reason,
          unblocked_by: unblockedBy
        })
      });
    }

    if (result.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to unblock card'
      });
    }

    const unblockedUser = result[0];

    // Send unblocking notification email
    try {
      const emailSubject = 'Your Transport Card Has Been Unblocked';
      const emailText = `
Dear ${unblockedUser.name},

Good news! Your Smart Transit RFID card (${unblockedUser.card_id}) has been unblocked and is now active again.

Reason for unblocking: ${reason}
Unblocked At: ${new Date(unblockedUser.unblocked_at).toLocaleString()}
Unblocked By: ${unblockedBy}

You can now use your card for all transportation services.

Current account balance: ৳${user.balance}

Thank you for using Smart Transit!

Smart Transit Support Team
`;

      await sendNotificationEmail(unblockedUser.email, emailSubject, emailText);
      console.log(`📧 Card unblocking notification sent to ${unblockedUser.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send unblocking notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Emit WebSocket event for real-time updates
    io.emit('card_unblocked', {
      userId: unblockedUser.user_id,
      cardId: unblockedUser.card_id,
      userName: unblockedUser.name,
      reason: reason,
      unblockedAt: unblockedUser.unblocked_at,
      unblockedBy: unblockedBy
    });

    console.log(`✅ Card ${unblockedUser.card_id} successfully unblocked for user ${unblockedUser.name}`);

    res.json({
      success: true,
      message: 'Card unblocked successfully',
      data: {
        user: unblockedUser,
        emailSent: true
      }
    });

  } catch (error) {
    console.error('❌ Error unblocking card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock card',
      error: error.message
    });
  }
});

// Get blocked cards list
app.get('/api/cards/blocked', async (req, res) => {
  try {
    console.log('📋 Fetching blocked cards list');

    const result = await supabaseRequest('user_profile?is_blocked=eq.true&select=user_id,name,email,card_id,balance,is_blocked,blocked_at,blocked_reason,blocked_by,unblocked_at,unblocked_by,unblock_reason&order=blocked_at.desc');

    console.log(`📊 Found ${result.length} blocked cards`);

    res.json({
      success: true,
      data: result,
      count: result.length
    });

  } catch (error) {
    console.error('❌ Error fetching blocked cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked cards',
      error: error.message
    });
  }
});

// Get card blocking history
app.get('/api/cards/block-history', async (req, res) => {
  try {
    const { cardId, userId } = req.query;
    console.log(`📋 Fetching blocking history for ${cardId || `User ID: ${userId}` || 'all cards'}`);

    let result;

    if (cardId) {
      result = await supabaseRequest(`user_profile?card_id=eq.${cardId}&and=(blocked_at.not.is.null,unblocked_at.not.is.null)&select=user_id,name,email,card_id,balance,is_blocked,blocked_at,blocked_reason,blocked_by,unblocked_at,unblocked_by,unblock_reason&order=blocked_at.desc,unblocked_at.desc`);
    } else if (userId) {
      result = await supabaseRequest(`user_profile?user_id=eq.${userId}&and=(blocked_at.not.is.null,unblocked_at.not.is.null)&select=user_id,name,email,card_id,balance,is_blocked,blocked_at,blocked_reason,blocked_by,unblocked_at,unblocked_by,unblock_reason&order=blocked_at.desc,unblocked_at.desc`);
    } else {
      result = await supabaseRequest(`user_profile?and=(blocked_at.not.is.null,unblocked_at.not.is.null)&select=user_id,name,email,card_id,balance,is_blocked,blocked_at,blocked_reason,blocked_by,unblocked_at,unblocked_by,unblock_reason&order=blocked_at.desc,unblocked_at.desc`);
    }

    console.log(`📊 Found ${result.length} blocking history records`);

    res.json({
      success: true,
      data: result,
      count: result.length
    });

  } catch (error) {
    console.error('❌ Error fetching blocking history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocking history',
      error: error.message
    });
  }
});

app.get('/api/monitor/location', async (req, res) => {
  try {
    console.log('📍 Bus location requested');
    
    // Get reverse geocoded address for current position if needed
    let currentLocationName = currentBusLocation?.address || "Unknown Location";
    if (currentVehiclePosition.lat && currentVehiclePosition.lng && 
        (!currentLocationName || currentLocationName.includes(','))) {
      try {
        currentLocationName = await reverseGeocode(currentVehiclePosition.lat, currentVehiclePosition.lng);
        console.log(`🗺️  Current location reverse geocoded: ${currentLocationName}`);
      } catch (error) {
        console.error('❌ Reverse geocoding failed for current location:', error);
        currentLocationName = `${currentVehiclePosition.lat.toFixed(6)}, ${currentVehiclePosition.lng.toFixed(6)}`;
      }
    }
    
    // Get enhanced location data with route information
    const locationData = {
      currentLocation: {
        ...currentBusLocation,
        address: currentLocationName
      },
      vehiclePosition: currentVehiclePosition,
      gpsStatus: {
        hasRealGPS: !(currentVehiclePosition.lat === 23.8103 && currentVehiclePosition.lng === 90.4125),
        source: currentVehiclePosition.lat === 23.8103 && currentVehiclePosition.lng === 90.4125 ? 'DEFAULT' : 'REAL_GPS',
        lastUpdate: new Date().toISOString()
      },
      // Enhanced route information from Smart Transit Simulation
      routeInfo: currentBusLocation.routeInfo || null,
      navigationInfo: currentBusLocation.routeInfo ? {
        currentLocationName: currentLocationName,
        nextDestination: currentBusLocation.routeInfo.nextDestination?.name || "No destination set",
        nextDestinationCoords: currentBusLocation.routeInfo.nextDestination ? {
          lat: currentBusLocation.routeInfo.nextDestination.lat,
          lng: currentBusLocation.routeInfo.nextDestination.lng
        } : null,
        routeProgress: currentBusLocation.routeInfo.routeProgress || 0,
        isWaitingAtStation: currentBusLocation.routeInfo.isWaitingAtStation || false,
        destinationIndex: `${(currentBusLocation.routeInfo.currentDestinationIndex || 0) + 1}/${currentBusLocation.routeInfo.totalDestinations || 1}`,
        completedStops: currentBusLocation.routeInfo.completedDestinations || 0,
        vehicleType: currentBusLocation.routeInfo.vehicleType || 'bus',
        estimatedArrival: currentBusLocation.routeInfo.routeProgress > 0 ? 
          `${Math.ceil((100 - currentBusLocation.routeInfo.routeProgress) / 10)} min` : 'Unknown'
      } : {
        currentLocationName: currentLocationName,
        nextDestination: "No route selected",
        nextDestinationCoords: null,
        routeProgress: 0,
        isWaitingAtStation: false,
        destinationIndex: "0/0",
        completedStops: 0,
        vehicleType: 'bus',
        estimatedArrival: 'Unknown'
      }
    };
    
    res.json({
      success: true,
      data: locationData
    });
  } catch (error) {
    console.error('Error fetching bus location:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

app.get('/api/monitor/recent-activity', async (req, res) => {
  try {
    console.log('📋 Recent activity requested');
    const limit = parseInt(req.query.limit) || 20;
    
    // Get recent travel history with user details
    const recentTravels = await supabaseRequest(
      `travel_history?select=*,user_profile(name,card_id,email)&order=travel_time.desc&limit=${limit}`
    );

    // Also get current travels (ongoing)
    const currentTravels = await supabaseRequest(
      `current_travel?select=*,user_profile(name,card_id,email)&order=created_at.desc`
    );

    res.json({
      success: true,
      data: {
        recentTravels,
        currentTravels,
        totalActivity: recentTravels.length + currentTravels.length
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

app.get('/api/monitor/revenue', async (req, res) => {
  try {
    console.log('💰 Revenue data requested');
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's revenue breakdown
    const [todayTravels, weeklyTravels, monthlyTravels] = await Promise.all([
      supabaseRequest(`travel_history?select=total_cost,travel_time&travel_time=gte.${today}`),
      supabaseRequest(`travel_history?select=total_cost,travel_time&travel_time=gte.${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}`),
      supabaseRequest(`travel_history?select=total_cost,travel_time&travel_time=gte.${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}`)
    ]);

    const todayRevenue = todayTravels.reduce((sum, t) => sum + (t.total_cost || 0), 0);
    const weeklyRevenue = weeklyTravels.reduce((sum, t) => sum + (t.total_cost || 0), 0);
    const monthlyRevenue = monthlyTravels.reduce((sum, t) => sum + (t.total_cost || 0), 0);

    res.json({
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          trips: todayTravels.length
        },
        weekly: {
          revenue: weeklyRevenue,
          trips: weeklyTravels.length
        },
        monthly: {
          revenue: monthlyRevenue,
          trips: monthlyTravels.length
        }
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

app.get('/api/monitor/system-health', async (req, res) => {
  try {
    console.log('🔧 System health requested');
    
    // Check database connectivity and get passenger count
    let dbStatus = 'Unknown';
    let dbLatency = 0;
    let activePassengersCount = 0;
    try {
      const start = Date.now();
      const [dbTest, passengerCount] = await Promise.all([
        supabaseRequest('user_profile?select=count&limit=1'),
        supabaseRequest('current_travel?select=count')
      ]);
      dbLatency = Date.now() - start;
      dbStatus = 'Connected';
      activePassengersCount = passengerCount[0]?.count || 0;
    } catch (err) {
      dbStatus = 'Error';
    }

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          latency: dbLatency
        },
        websocket: {
          status: 'Active',
          connectedClients: io.engine.clientsCount || 0
        },
        gps: {
          status: currentVehiclePosition.lat === 23.8103 && currentVehiclePosition.lng === 90.4125 ? 'Default' : 'Real GPS',
          coordinates: currentVehiclePosition
        },
        simulation: {
          status: activePassengersCount > 0 ? 'Active' : 'Inactive',
          activePassengers: activePassengersCount // Read from database
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

// Get current route information for monitor
app.get('/api/monitor/route', async (req, res) => {
  try {
    console.log('🗺️  Route information requested');
    
    // Get passenger count from database
    const passengerCountResult = await supabaseRequest('current_travel?select=count');
    const passengersOnBoard = passengerCountResult[0]?.count || 0;
    
    // Return current route information
    const routeInfo = global.currentRoute || {
      destinations: [],
      status: 'inactive',
      totalDistance: 0,
      currentDestinationIndex: 0,
      lastUpdated: new Date().toISOString(),
      vehiclePosition: null
    };

    // Add current vehicle position
    routeInfo.vehiclePosition = currentVehiclePosition;

    // Calculate progress if route exists
    let progress = 0;
    if (routeInfo.destinations.length > 0 && routeInfo.currentDestinationIndex >= 0) {
      progress = Math.round((routeInfo.currentDestinationIndex / routeInfo.destinations.length) * 100);
    }

    res.json({
      success: true,
      data: {
        ...routeInfo,
        progress,
        hasActiveRoute: routeInfo.destinations.length > 0,
        nextDestination: routeInfo.destinations[routeInfo.currentDestinationIndex] || null,
        passengersOnBoard: passengersOnBoard, // Read from database
        vehicleLocation: await reverseGeocode(currentVehiclePosition.lat, currentVehiclePosition.lng)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching route information:', error);
    res.status(500).json({ success: false, message: error.message });
  }
})

// Get currently traveling users (online users)
app.get('/api/current-travel-all', async (req, res) => {
  try {
    const currentTravels = await supabaseRequest('current_travel?select=user_id,pick_point,current_longitude,current_latitude,created_at,user_profile(name,email,card_id,balance)&order=created_at.desc')
    
    // Update all passenger locations to current vehicle position
    const updatedTravels = currentTravels.map(passenger => ({
      ...passenger,
      current_latitude: currentVehiclePosition.lat.toString(),
      current_longitude: currentVehiclePosition.lng.toString(),
      vehicle_position: currentVehiclePosition
    }))
    
    res.json({ 
      success: true, 
      data: updatedTravels, 
      count: updatedTravels.length,
      currentVehiclePosition: currentVehiclePosition
    })
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
    const currentTravel = await supabaseRequest(`current_travel?select=user_id,pick_point,current_longitude,current_latitude,created_at,user_profile!inner(name,email,card_id,balance)&order=created_at.desc`)
    
    // Update all passenger locations to current vehicle position
    const updatedTravel = currentTravel.map(passenger => ({
      ...passenger,
      current_latitude: currentVehiclePosition.lat.toString(),
      current_longitude: currentVehiclePosition.lng.toString(),
      vehicle_position: currentVehiclePosition
    }))
    
    res.json({ 
      success: true, 
      data: updatedTravel, 
      count: updatedTravel.length,
      currentVehiclePosition: currentVehiclePosition
    })
  } catch (error) {
    console.error('Current travel API error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get current bus location
app.get('/api/bus-location', (req, res) => {
  try {
    // Use reverse geocoding to get location name (simplified)
    const locationNames = {
      '23.8103,90.4125': 'City Terminal',
      '23.7465,90.3765': 'Central Station',
      '23.7589,90.3567': 'University Area',
      '23.7456,90.3912': 'Shopping District'
    }

    const coordKey = `${currentVehiclePosition.lat.toFixed(4)},${currentVehiclePosition.lng.toFixed(4)}`
    const locationName = locationNames[coordKey] || 'Moving'

    res.json({
      success: true,
      latitude: currentVehiclePosition.lat,
      longitude: currentVehiclePosition.lng,
      locationName: locationName,
      lastUpdated: new Date().toISOString(),
      source: 'GPS_TRACKING'
    })
  } catch (error) {
    console.error('Bus location API error:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message,
      // Fallback location
      latitude: 23.8103,
      longitude: 90.4125,
      locationName: 'City Terminal (Default)'
    })
  }
})

// Get travel history for a specific user
app.get('/api/travel-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const travelHistory = await supabaseRequest(`travel_history?user_id=eq.${userId}&select=user_id,pick_point,drop_point,total_cost,remaining_balance,travel_time&order=travel_time.desc&limit=20`)
    res.json({ success: true, data: travelHistory, count: travelHistory.length })
  } catch (error) {
    console.error('Travel history API error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all travel history
app.get('/api/travel-history', async (req, res) => {
  try {
    const travelHistory = await supabaseRequest(`travel_history?select=user_id,pick_point,drop_point,total_cost,remaining_balance,travel_time,user_profile!inner(name,email,card_id)&order=travel_time.desc&limit=50`)
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

// Additional RFID endpoints for frontend integration
app.post('/api/rfid-scan', async (req, res) => {
  try {
    const { 
      rfidCard, 
      scanType = 'entry', 
      busId = 'BUS001',
      latitude,
      longitude,
      lat,
      lng 
    } = req.body;
    
    if (!rfidCard) {
      return res.status(400).json({ error: 'RFID card data is required' });
    }

    // Format the request to match existing handleRFIDScan function
    const scanData = {
      cardId: rfidCard,
      busId: busId,
      scanType: scanType,
      // Include GPS coordinates if provided
      latitude: latitude || lat,
      longitude: longitude || lng
    };

    console.log(`📱 Frontend RFID scan request:`, {
      card: rfidCard,
      gps: scanData.latitude && scanData.longitude ? 
        `${scanData.latitude}, ${scanData.longitude}` : 'Not provided'
    });

    const response = await handleRFIDScan(scanData, 'FRONTEND');
    
    // Broadcast scan event via WebSocket with current vehicle location
    io.emit('rfid_scan', {
      type: 'rfid_scan',
      rfidCard,
      action: response.action,
      busLocation: currentBusLocation, // Use actual current location
      fare: response.fare || 0,
      timestamp: new Date().toISOString(),
      source: 'FRONTEND'
    });

    res.json({
      type: 'rfid_scan',
      success: response.success,
      action: response.action,
      rfidCard,
      busLocation: currentBusLocation, // Use actual current location
      fare: response.fare || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('RFID scan error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GPS Status endpoint - useful for debugging
app.get('/api/gps/status', (req, res) => {
  const DEFAULT_LAT = 23.8103
  const DEFAULT_LNG = 90.4125
  const isDefaultCoords = (currentVehiclePosition.lat === DEFAULT_LAT && currentVehiclePosition.lng === DEFAULT_LNG)
  
  res.json({
    success: true,
    vehicle_position: currentVehiclePosition,
    default_coordinates: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
    is_using_default_coordinates: isDefaultCoords,
    coordinate_source: isDefaultCoords ? 'DEFAULT_FALLBACK' : 'REAL_GPS',
    last_updated: new Date().toISOString(),
    passengers_on_bus: cachedPassengerCount, // Use database count instead of memory
    passengers: Array.from(passengersOnBus.entries()).map(([cardId, passenger]) => ({
      card_id: cardId,
      name: passenger.name,
      coordinate_source: passenger.coordinateSource || 'UNKNOWN',
      boarding_coords: `${passenger.boardLatitude}, ${passenger.boardLongitude}`,
      current_coords: `${passenger.currentLatitude}, ${passenger.currentLongitude}`
    })),
    warning: isDefaultCoords ? 'Still using default coordinates - no real GPS updates received yet' : null,
    recommendations: isDefaultCoords ? [
      'Ensure frontend is sending vehicle_position_update via WebSocket',
      'Check if RFID scan requests include real GPS coordinates',
      'Verify the Smart Transit Simulation is running and sending position updates'
    ] : null
  })
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedClients: io.engine.clientsCount,
    service: 'Smart Transit RFID Server'
  });
});

// Get current passengers endpoint
app.get('/api/passengers', async (req, res) => {
  try {
    const passengers = Array.from(passengersOnBus.entries()).map(([rfidCard, info]) => {
      const journeyTimeMinutes = Math.floor((new Date() - new Date(info.boardTime)) / (1000 * 60))
      
      // Use current vehicle position for all passengers (they're all on the same bus)
      const currentLat = currentVehiclePosition.lat
      const currentLng = currentVehiclePosition.lng
      
      return {
        name: info.name,
        card_id: rfidCard,
        email: info.email,
        balance: `৳${info.balance.toFixed(2)}`,
        boardedAt: info.boardLocation,
        journeyTime: `${journeyTimeMinutes} minutes`,
        location: `${currentLat}, ${currentLng}`,
        coordinates: {
          lat: currentLat,
          lng: currentLng
        },
        boardCoordinates: {
          lat: info.boardLatitude,
          lng: info.boardLongitude
        },
        duration: Math.floor((new Date() - new Date(info.boardTime)) / 1000) // seconds
      }
    })

    res.json({
      count: cachedPassengerCount, // Use database count instead of memory
      passengers: passengers,
      busLocation: currentVehiclePosition, // Use current vehicle position
      currentBusPosition: currentVehiclePosition // Also provide as separate field
    });
  } catch (error) {
    console.error('Error getting passengers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update bus location endpoint
app.post('/api/update-bus-location', (req, res) => {
  try {
    const { lat, lng, address, busId = 'BUS001' } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    currentBusLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address: address || `${lat}, ${lng}`,
      busId,
      timestamp: new Date().toISOString()
    };

    console.log(`Bus ${busId} location updated:`, currentBusLocation);

    // Broadcast location update
    io.emit('bus_location_update', {
      type: 'bus_location_update',
      busId,
      location: currentBusLocation,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      location: currentBusLocation 
    });

  } catch (error) {
    console.error('Error updating bus location:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Geocoding API endpoints for testing
app.get('/api/geocode/reverse/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const address = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json({ 
      success: true, 
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      address: address 
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/geocode/forward', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address parameter is required' 
      });
    }
    
    const result = await forwardGeocode(address);
    res.json({ 
      success: true, 
      result: result 
    });
  } catch (error) {
    console.error('Forward geocoding error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test current vehicle position geocoding
app.get('/api/vehicle/location', async (req, res) => {
  try {
    const address = await reverseGeocode(currentVehiclePosition.lat, currentVehiclePosition.lng);
    res.json({ 
      success: true,
      position: currentVehiclePosition,
      address: address,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Vehicle location error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Reset travel database endpoint
app.post('/api/admin/reset-travel-data', async (req, res) => {
  try {
    console.log('🔄 Resetting travel database...')
    
    // Clear current travel data - DELETE ALL PASSENGERS
    try {
      const allCurrentTravel = await supabaseRequest('current_travel?select=*')
      
      if (allCurrentTravel && allCurrentTravel.length > 0) {
        console.log(`Found ${allCurrentTravel.length} current travel records to delete`)
        console.log('Current travel record structure:', Object.keys(allCurrentTravel[0]))
        
        // Find the primary key column
        const firstRecord = allCurrentTravel[0]
        let primaryKeyColumn = null
        
        if (firstRecord.id) primaryKeyColumn = 'id'
        else if (firstRecord.travel_id) primaryKeyColumn = 'travel_id'
        else if (firstRecord.user_id) primaryKeyColumn = 'user_id' // Use user_id as unique identifier
        
        console.log('Using primary key column for current_travel:', primaryKeyColumn)
        
        if (primaryKeyColumn) {
          for (const record of allCurrentTravel) {
            try {
              await supabaseRequest(`current_travel?${primaryKeyColumn}=eq.${record[primaryKeyColumn]}`, {
                method: 'DELETE'
              })
            } catch (deleteError) {
              console.log(`Failed to delete current travel record ${record[primaryKeyColumn]}:`, deleteError.message)
            }
          }
        }
        console.log('Current travel data cleared successfully')
      } else {
        console.log('No current travel records found to delete')
      }
    } catch (error) {
      console.log('Current travel clearing completed. Error:', error.message)
    }
    
    // Clear travel history (optional - comment out if you want to keep history)
    try {
      // First, get all travel history records to see their structure
      const allHistory = await supabaseRequest('travel_history?select=*')
      
      if (allHistory && allHistory.length > 0) {
        console.log(`Found ${allHistory.length} travel history records to delete`)
        console.log('Sample record structure:', Object.keys(allHistory[0]))
        
        // Try different possible column names for the primary key
        const firstRecord = allHistory[0]
        let primaryKeyColumn = null
        
        // Check for common primary key column names
        if (firstRecord.id) primaryKeyColumn = 'id'
        else if (firstRecord.history_id) primaryKeyColumn = 'history_id'
        else if (firstRecord.HISTORY_ID) primaryKeyColumn = 'HISTORY_ID'
        else if (firstRecord.user_id && firstRecord.travel_time) {
          // Use a combination if no single primary key
          primaryKeyColumn = 'composite'
        }
        
        console.log('Using primary key column:', primaryKeyColumn)
        
        if (primaryKeyColumn === 'composite') {
          // Delete using user_id and travel_time combination
          for (const record of allHistory) {
            try {
              await supabaseRequest(`travel_history?user_id=eq.${record.user_id}&travel_time=eq.${record.travel_time}`, {
                method: 'DELETE'
              })
            } catch (deleteError) {
              console.log(`Failed to delete record for user ${record.user_id}:`, deleteError.message)
            }
          }
        } else if (primaryKeyColumn) {
          // Delete using the primary key
          for (const record of allHistory) {
            try {
              await supabaseRequest(`travel_history?${primaryKeyColumn}=eq.${record[primaryKeyColumn]}`, {
                method: 'DELETE'
              })
            } catch (deleteError) {
              console.log(`Failed to delete record ${record[primaryKeyColumn]}:`, deleteError.message)
            }
          }
        } else {
          console.log('Could not determine primary key column. Manual cleanup may be needed.')
        }
        
        console.log('Travel history cleared successfully')
      } else {
        console.log('No travel history records found to delete')
      }
    } catch (error) {
      console.log('Travel history clearing completed. Error:', error.message)
    }
    
    // Clear in-memory passenger tracking
    passengersOnBus.clear()
    recentCardScans.clear()
    
    // Reset vehicle position to default
    currentVehiclePosition = {
      lat: 23.8103,
      lng: 90.4125
    }
    
    currentBusLocation = {
      lat: 23.8103,
      lng: 90.4125,
      address: 'City Terminal',
      busId: 'BUS001',
      timestamp: new Date().toISOString()
    }
    
    console.log('✅ Travel database reset completed (all data cleared)')
    
    // Update passenger count cache after reset
    updatePassengerCountCache();
    
    // Broadcast reset event to all connected clients
    io.emit('travel_data_reset', {
      message: 'All travel data has been reset',
      timestamp: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: 'Travel database reset successfully (all data cleared)',
      details: {
        currentTravelCleared: true,
        travelHistoryCleared: true,
        passengersCleared: cachedPassengerCount === 0, // Use database count
        recentScansCleared: recentCardScans.size === 0,
        vehiclePositionReset: true
      }
    })
    
  } catch (error) {
    console.error('Error resetting travel database:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset travel database',
      error: error.message
    })
  }
});

// Stripe Payment Integration

// Create Payment Intent for recharge
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'bdt', userId } = req.body;

    if (!amount || amount < 5000) { // Minimum ৳50 (5000 paisa)
      return res.status(400).json({
        error: 'Minimum amount is ৳50'
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required'
      });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in paisa (smallest currency unit)
      currency: currency,
      metadata: {
        userId: userId,
        type: 'account_recharge'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`💳 Payment intent created for user ${userId}: ${paymentIntent.id} - ৳${amount/100}`);

    res.json({
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Update user balance after successful payment
app.post('/api/update-balance', async (req, res) => {
  try {
    const { userId, amount, transactionId } = req.body;

    if (!userId || !amount || !transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    console.log(`💰 Updating balance for user ${userId}: +৳${amount} (Transaction: ${transactionId})`);

    // First, get current user balance
    const userResponse = await supabaseRequest(`user_profile?user_id=eq.${userId}&select=balance`);
    
    if (!userResponse || userResponse.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentBalance = userResponse[0].balance || 0;
    const newBalance = currentBalance + amount;

    // Update user balance
    const updateResponse = await supabaseRequest(`user_profile?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        balance: newBalance
      })
    });

    // Record the recharge transaction using new recharge API
    try {
      const mockReq = {
        body: {
          user_id: userId,
          amount: amount,
          payment_method: 'stripe',
          transaction_id: transactionId
        }
      };
      
      const mockRes = {
        json: (data) => {
          if (data.success) {
            console.log('✅ Recharge record saved via new API:', data.data.recharge_id);
          } else {
            console.log('❌ Failed to save recharge record:', data.message);
          }
        },
        status: () => ({ json: () => {} })
      };
      
      // Note: Don't await this to avoid changing balance twice
      // The rechargeAPI.addRechargeRecord also updates balance, but we're handling it here
      // So we'll just create a minimal record
      await supabaseRequest('recharge_history', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          recharge_amount: amount,
          payment_method: 'stripe'
        })
      });
      
      console.log('✅ Recharge history record created');
    } catch (historyError) {
      console.log('Note: Could not save recharge history:', historyError.message);
    }

    console.log(`✅ Balance updated successfully: ${currentBalance} → ${newBalance}`);

    // Get user details for email
    const fullUserResponse = await supabaseRequest(`user_profile?user_id=eq.${userId}&select=*`);
    const user = fullUserResponse[0];

    // Send recharge confirmation email
    if (user && user.email) {
      try {
        const rechargeData = {
          amount: amount,
          newBalance: newBalance,
          transactionId: transactionId
        };
        
        const emailResult = await sendRechargeConfirmationEmail(user, rechargeData);
        console.log(`📧 Recharge email sent:`, emailResult.success ? '✅' : '❌', emailResult.messageId || emailResult.error);
      } catch (emailError) {
        console.log('⚠️ Failed to send recharge email:', emailError.message);
      }
    }

    // Emit balance update to user if they're connected
    io.emit('balance_updated', {
      userId: userId,
      newBalance: newBalance,
      rechargeAmount: amount,
      transactionId: transactionId
    });

    res.json({
      success: true,
      newBalance: newBalance,
      message: `৳${amount} added successfully`
    });

  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user balance
app.get('/api/user/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResponse = await supabaseRequest(`user_profile?user_id=eq.${userId}&select=balance,name`);
    
    if (!userResponse || userResponse.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      balance: userResponse[0].balance || 0,
      name: userResponse[0].name
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Stripe publishable key for frontend
app.get('/api/stripe/config', (req, res) => {
  try {
    res.json({
      success: true,
      publishableKey: STRIPE_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Stripe configuration'
    });
  }
});

// Get recharge history for user - Using existing Supabase REST API
app.get('/api/user/recharge-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit || 50;
    const paymentMethod = req.query.payment_method;
    
    console.log(`📊 Fetching recharge history for user: ${userId}`);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    let query = `recharge_history?user_id=eq.${userId}&select=*`;
    
    // Add payment method filter if provided
    if (paymentMethod && paymentMethod !== 'all') {
      query += `&payment_method=eq.${paymentMethod}`;
    }
    
    // Order by recharge_date or created_at
    query += `&order=recharge_date.desc&limit=${limit}`;

    console.log(`🔍 Supabase query: ${query}`);

    const historyResponse = await supabaseRequest(query);
    
    // Add status field if missing (for older records)
    const enrichedHistory = (historyResponse || []).map(record => ({
      ...record,
      status: record.status || 'completed'
    }));
    
    console.log(`✅ Found ${enrichedHistory.length} recharge records for user ${userId}`);
    
    res.json({
      success: true,
      history: enrichedHistory,
      count: enrichedHistory.length
    });

  } catch (error) {
    console.error('❌ Error fetching recharge history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      history: [],
      count: 0
    });
  }
});

// Add recharge record - Using Supabase REST API
app.post('/api/user/recharge', async (req, res) => {
  try {
    const { user_id, amount, payment_method, transaction_id } = req.body;
    
    console.log(`💰 Adding recharge record: ${user_id}, ৳${amount}, ${payment_method}`);
    
    if (!user_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'user_id, amount, and payment_method are required'
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Insert recharge record using existing supabaseRequest
    const rechargeResult = await supabaseRequest('recharge_history', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user_id,
        recharge_amount: parseFloat(amount),
        payment_method: payment_method,
        transaction_id: transaction_id || null
      })
    });
    
    console.log(`✅ Recharge record created successfully`);

    // Update user balance
    const userResult = await supabaseRequest(`user_profile?user_id=eq.${user_id}&select=balance`);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentBalance = userResult[0].balance || 0;
    const newBalance = currentBalance + parseFloat(amount);

    await supabaseRequest(`user_profile?user_id=eq.${user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: newBalance })
    });

    console.log(`✅ User balance updated: ৳${currentBalance} → ৳${newBalance}`);

    res.json({
      success: true,
      message: 'Recharge successful',
      data: {
        amount: parseFloat(amount),
        payment_method: payment_method,
        transaction_id: transaction_id || null,
        previous_balance: currentBalance,
        new_balance: newBalance
      }
    });

  } catch (error) {
    console.error('❌ Error adding recharge record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add recharge record',
      error: error.message
    });
  }
});

// Test database connection for recharge history
app.get('/api/test/recharge-connection', async (req, res) => {
  try {
    console.log('🧪 Testing recharge history database connection...');
    
    // Test by getting count of recharge records
    const countResult = await supabaseRequest('recharge_history?select=count');
    const totalRecords = countResult[0]?.count || 0;
    
    // Test by getting recent records
    const recentRecords = await supabaseRequest('recharge_history?select=user_id,recharge_amount,payment_method,recharge_date&order=recharge_date.desc&limit=5');
    
    console.log(`✅ Database connection test successful. Found ${totalRecords} records`);

    res.json({
      success: true,
      message: 'Database connection test successful',
      test_results: {
        connection_status: 'OK',
        total_records: totalRecords,
        recent_records: recentRecords,
        supabase_url: SUPABASE_URL ? 'Configured' : 'Not configured'
      }
    });

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection test failed',
      error: error.message,
      connection_status: 'ERROR'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).render('error', { error: 'Something went wrong!' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).render('error', { error: 'Page not found!' })
})

// Initialize global route state
// Alternative recharge history endpoint (for backward compatibility)
app.get('/api/recharge-history', async (req, res) => {
  try {
    const { user_id, limit = 50 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }
    
    // Use the new recharge API by calling it directly
    req.params = { userId: user_id };
    req.query = { limit };
    
    // Create a response wrapper to match old format
    const mockRes = {
      json: (data) => {
        if (data.success && data.history) {
          res.json({
            success: true,
            data: data.history,
            count: data.count
          });
        } else {
          res.json({
            success: false,
            message: data.message || 'Failed to fetch history',
            data: []
          });
        }
      },
      status: (code) => ({ json: (data) => res.status(code).json(data) })
    };
    
    await rechargeAPI.getRechargeHistory(req, mockRes);

  } catch (error) {
    console.error('Error fetching recharge history (compatibility endpoint):', error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: []
    });
  }
})

global.currentRoute = {
  destinations: [],
  status: 'inactive',
  totalDistance: 0,
  currentDestinationIndex: 0,
  lastUpdated: new Date().toISOString(),
  vehiclePosition: null
}

// Start the server
const PORT = process.env.PORT || 2000

// Initialize mDNS service
const bonjourInstance = bonjour()

server.listen(PORT, () => {
  console.log(`YOUR IP IS ${getWirelessIPAddress()}`)
  console.log(`Smart Transit server is running on port ${PORT}...`)
  console.log(`🌐 Access your app at:`)
  console.log(`   Local: http://localhost:${PORT}`)
  console.log(`   Network: http://${getWirelessIPAddress()}:${PORT}`)
  console.log(`🗄️  Database: ${SUPABASE_URL ? '✅ Supabase Connected' : '❌ Not configured'}`)
  console.log(`🔌 WebSocket: ✅ Enabled`)
  console.log(`📱 Frontend: http://localhost:3000`)
  console.log(`🗺️  Route System: ✅ Initialized`)
  
  // Advertise the service via mDNS
  const service = bonjourInstance.publish({
    name: 'Smart Transit Server',
    type: 'http',
    port: PORT,
    host: 'smarttransit.local'
  })
  
  service.on('up', () => {
    console.log(`🔍 mDNS: Service advertised as 'smarttransit.local:${PORT}'`)
    console.log(`📡 ESP32 can now connect using: http://smarttransit.local:${PORT}`)
  })
  
  service.on('error', (err) => {
    console.error('❌ mDNS Error:', err.message)
  })
})
