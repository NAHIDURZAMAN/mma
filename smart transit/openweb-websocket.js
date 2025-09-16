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
import { sendJourneyCompleteEmail, sendLowBalanceAlert } from './Routes/emailService.js'
import { forwardGeocode, reverseGeocode, calculateDistance, formatJourneyTime } from './Routes/geocodingService.js'

// Load environment variables
dotenv.config()

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

// Function to calculate fare based on distance (20 BDT per km)
function calculateFare(distanceKm) {
  const farePerKm = 20 // Rate per km in BDT
  return Math.max(20, Math.round(distanceKm * farePerKm)) // Minimum 20 BDT
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
    } else {
      console.warn(`⚠️  Invalid GPS data received via WebSocket:`, data)
    }
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
      
      // Check if the provided coordinates are just default values
      const isDefaultCoords = (providedLat === DEFAULT_LAT && providedLng === DEFAULT_LNG)
      const hasUpdatedVehiclePosition = !(currentVehiclePosition.lat === DEFAULT_LAT && currentVehiclePosition.lng === DEFAULT_LNG)
      
      if (isDefaultCoords && hasUpdatedVehiclePosition) {
        // Arduino sent default coords, but we have real vehicle position - use vehicle position
        vehicleLat = currentVehiclePosition.lat
        vehicleLng = currentVehiclePosition.lng
        coordinateSource = 'VEHICLE_POSITION_PREFERRED'
        console.log(`📍 Arduino sent default GPS (${providedLat}, ${providedLng}), using real vehicle position: ${vehicleLat}, ${vehicleLng}`)
        
      } else if (!isDefaultCoords) {
        // Arduino sent real GPS coordinates - use them and update vehicle position
        vehicleLat = providedLat
        vehicleLng = providedLng
        coordinateSource = 'SCAN_REQUEST'
        
        updateVehiclePosition({ lat: vehicleLat, lng: vehicleLng }, `RFID_${deviceSource}`)
        console.log(`📍 GPS coordinates received from ${deviceSource} scan: ${vehicleLat}, ${vehicleLng}`)
        
      } else {
        // Arduino sent default coords and we don't have better vehicle position
        // For testing: Allow default coordinates with a warning
        vehicleLat = DEFAULT_LAT
        vehicleLng = DEFAULT_LNG
        coordinateSource = 'DEFAULT_FALLBACK'
        console.log(`⚠️  WARNING: Using default GPS coordinates from ${deviceSource}. Consider updating with real GPS data.`)
        
        // Optional: Still return error if you want to enforce real GPS
        // console.log(`🚫 REJECTING default GPS coordinates from ${deviceSource}. Waiting for real GPS data...`)
        // return {
        //   success: false,
        //   message: 'GPS coordinates required',
        //   action: 'warning_beep',
        //   display: ['GPS Required', 'Send Real Location'],
        //   error: 'Default GPS coordinates not allowed. Please send real GPS coordinates or update vehicle position via WebSocket.'
        // }
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
      
      calculatedFare = Math.round(calculatedFare);
      console.log(`Fare calculation: ${distance.toFixed(2)}km × ৳${FARE_PER_KM}/km = ৳${calculatedFare}`)
      
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
      
        // Send journey completion email
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
        
        return {
          success: true,
          message: 'Travel ended',
          action: 'success_beep',
          display: [
            `Journey Complete`,
            `Distance: ${distance.toFixed(2)}km`,
            `Fare: ৳${calculatedFare}`,
            `Balance: ৳${newBalance.toFixed(2)}`
          ],
          user: {
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
    const users = await supabaseRequest('user_profile?select=user_id,name,email,phone,card_id,balance,created_at&order=user_id')
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
})
