import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { calculateFare } from './fareCalculator.js';
import { sendTravelEmail } from './emailService.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store active connections
const clients = new Set();

// Store current bus location (this would come from GPS in real system)
let currentBusLocation = {
  lat: 23.8103,
  lng: 90.4125,
  address: "Dhaka City Center"
};

// Store passengers currently on bus
const passengersOnBus = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// API endpoint to simulate RFID card scan
app.post('/api/rfid-scan', async (req, res) => {
  try {
    const { rfidCard, scanType = 'entry', busId = 'BUS001' } = req.body;
    
    if (!rfidCard) {
      return res.status(400).json({ error: 'RFID card data is required' });
    }

    console.log(`RFID Scan - Card: ${rfidCard}, Type: ${scanType}, Bus: ${busId}`);

    // Check if user is already on bus
    const isAlreadyOnBus = passengersOnBus.has(rfidCard);

    let action, fare = 0, startLocation = null, endLocation = null;

    if (scanType === 'entry' && !isAlreadyOnBus) {
      // Passenger boarding
      action = 'board';
      startLocation = { ...currentBusLocation };
      
      passengersOnBus.set(rfidCard, {
        boardTime: new Date(),
        boardLocation: startLocation,
        userId: rfidCard,
        busId: busId
      });

      console.log(`Passenger ${rfidCard} boarded at`, startLocation);

    } else if (scanType === 'exit' && isAlreadyOnBus) {
      // Passenger exiting
      action = 'exit';
      const boardingInfo = passengersOnBus.get(rfidCard);
      startLocation = boardingInfo.boardLocation;
      endLocation = { ...currentBusLocation };

      // Calculate fare based on distance
      fare = calculateFare(
        startLocation.lat,
        startLocation.lng,
        endLocation.lat,
        endLocation.lng,
        'bus' // vehicle type
      );

      // Remove passenger from bus
      passengersOnBus.delete(rfidCard);

      // Send travel completion email
      try {
        await sendTravelEmail({
          userEmail: `user${rfidCard}@example.com`, // In real system, get from database
          userName: `User ${rfidCard}`,
          tripDetails: {
            startLocation: startLocation.address || `${startLocation.lat}, ${startLocation.lng}`,
            endLocation: endLocation.address || `${endLocation.lat}, ${endLocation.lng}`,
            startTime: boardingInfo.boardTime,
            endTime: new Date(),
            distance: calculateDistance(startLocation.lat, startLocation.lng, endLocation.lat, endLocation.lng),
            fare: fare,
            busId: busId,
            paymentMethod: 'RFID Card',
            transactionId: `TXN${Date.now()}`
          }
        });
        console.log(`Travel completion email sent for ${rfidCard}`);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }

      console.log(`Passenger ${rfidCard} exited. Fare: $${fare.toFixed(2)}`);

    } else {
      // Invalid scan (trying to board when already on bus, or exit when not on bus)
      action = 'invalid';
      console.log(`Invalid scan for ${rfidCard}. Already on bus: ${isAlreadyOnBus}, Scan type: ${scanType}`);
    }

    // Prepare response data
    const responseData = {
      type: 'rfid_scan',
      success: true,
      action,
      rfidCard,
      busLocation: currentBusLocation,
      fare,
      startLocation,
      endLocation,
      passengersOnBus: passengersOnBus.size,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected WebSocket clients
    broadcast(responseData);

    // Send response
    res.json(responseData);

  } catch (error) {
    console.error('Error processing RFID scan:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// API endpoint to update bus location
app.post('/api/update-bus-location', (req, res) => {
  try {
    const { lat, lng, address, busId = 'BUS001' } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    currentBusLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address: address || `${lat}, ${lng}`
    };

    console.log(`Bus ${busId} location updated:`, currentBusLocation);

    // Broadcast location update
    broadcast({
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

// API endpoint to get current passengers
app.get('/api/passengers', (req, res) => {
  const passengers = Array.from(passengersOnBus.entries()).map(([rfidCard, info]) => ({
    rfidCard,
    ...info,
    duration: Math.floor((new Date() - info.boardTime) / 1000) // seconds
  }));

  res.json({
    count: passengers.length,
    passengers,
    busLocation: currentBusLocation
  });
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedClients: clients.size,
    passengersOnBus: passengersOnBus.size
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚌 Enhanced RFID Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`📍 Initial bus location:`, currentBusLocation);
});

export default app;
