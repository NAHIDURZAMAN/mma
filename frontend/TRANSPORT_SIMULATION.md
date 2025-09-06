# Transport Simulation System

## Overview

This advanced transport simulation system provides a virtual environment for testing and demonstrating smart transit RFID systems. It includes real-time vehicle tracking, distance-based fare calculation, and interactive mapping using the Geopify API.

## Features

### 🚌 Virtual Transport Fleet
- Multiple vehicles operating on predefined routes
- Real-time vehicle position updates
- Passenger capacity management
- Dynamic route following with stops

### 🗺️ Interactive Mapping
- Live map display using Geopify API
- Real-time vehicle tracking on map
- Route visualization
- Stop/station markers
- Journey destination indicators

### 💰 Dynamic Fare Calculation
- Distance-based fare computation
- Route-specific pricing
- Minimum fare enforcement
- Real-time fare estimates

### 👥 User Integration
- Select real users from the database
- Card-based journey simulation
- Balance checking and deduction
- Journey history tracking

### ⚡ Real-time Simulation
- Live vehicle movement
- Passenger boarding/alighting
- Journey progress tracking
- WebSocket integration for real-time updates

## Getting Started

### 1. Set up Geopify API

1. Sign up at [Geopify](https://www.geoapify.com/)
2. Get your free API key
3. Copy `.env.local.example` to `.env.local`
4. Add your API key to `NEXT_PUBLIC_GEOPIFY_API_KEY`

```bash
cp .env.local.example .env.local
# Edit .env.local and add your Geopify API key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Application

```bash
npm run dev
```

### 4. Access Transport Simulation

Navigate to: `http://localhost:3000/transport-sim`

## How It Works

### Simulation Flow

1. **User Selection**: Choose a registered user from the database
2. **Location Setup**: Select start location (and optionally end location)
3. **Journey Start**: System finds nearest available vehicle
4. **Real-time Travel**: Vehicle moves along route with passenger
5. **Fare Calculation**: Distance-based fare computed using Geopify
6. **Journey Completion**: Passenger disembarks at destination

### Map Integration

- **Green Markers**: Empty vehicles available for pickup
- **Blue Markers**: Vehicles carrying passengers
- **Red Markers**: Journey destinations
- **Orange Markers**: Bus stops and stations

### Route System

The simulation includes predefined routes in Dhaka:

1. **University - Commercial Route**
   - Dhaka University → Shahbagh → New Market → Motijheel
   - Fare: ৳2.5/km (minimum ৳10)

2. **Residential - City Route**
   - Mirpur 1 → Kallayanpur → Farmgate → Dhanmondi → New Market
   - Fare: ৳3.0/km (minimum ৳12)

3. **Historical Circuit**
   - Gulistan → Sadarghat → Motijheel → Shahbagh
   - Fare: ৳2.0/km (minimum ৳8)

## API Integration

### Real-time Updates
- WebSocket connection for live updates
- Vehicle position broadcasting
- Journey status notifications
- System health monitoring

### Backend Integration
- User data from existing database
- RFID card validation
- Balance management
- Journey history storage

## Configuration

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:2000

# Geopify API Key
NEXT_PUBLIC_GEOPIFY_API_KEY=your-api-key-here
```

### Customization

#### Adding New Locations
Edit `src/lib/geopify.ts` and add to `DEFAULT_LOCATIONS`:

```typescript
{
  lat: 23.XXXX,
  lng: 90.XXXX,
  name: "Your Location",
  address: "Full Address"
}
```

#### Creating New Routes
Add to `TRANSPORT_ROUTES` in `src/lib/geopify.ts`:

```typescript
{
  id: 'route-x',
  name: 'Your Route Name',
  stops: [/* your stops */],
  farePerKm: 2.5,
  minimumFare: 10
}
```

#### Adjusting Vehicle Behavior
Modify vehicle parameters in `src/lib/simulator.ts`:

```typescript
const vehicle: VirtualVehicle = {
  speed: 25 + Math.random() * 15, // 25-40 km/h
  capacity: 40, // passengers
  // ... other properties
};
```

## Features in Detail

### Distance Calculation
- Uses Haversine formula for accurate distance calculation
- Geopify API for route optimization
- Real-time distance updates during journey

### Fare System
- Configurable per-route pricing
- Minimum fare protection
- Real-time fare calculation
- Integration with user balance system

### Vehicle Management
- Multiple vehicles per route
- Capacity-based passenger management
- Direction-aware route following
- Stop timing simulation

### Map Features
- Static map generation with markers
- Real-time position updates
- Multi-color marker system
- Automatic centering and zoom

## Troubleshooting

### Map Not Loading
1. Check Geopify API key in `.env.local`
2. Verify API key has sufficient quota
3. Check browser console for errors
4. Ensure internet connection is stable

### No Vehicles Available
1. Check if simulation is running
2. Verify vehicle capacity isn't exceeded
3. Restart simulation if needed

### Fare Calculation Issues
1. Verify start/end locations are valid
2. Check route configuration
3. Ensure distance calculation is working

## Support

For issues and questions:
1. Check browser console for errors
2. Verify all environment variables are set
3. Ensure backend is running on port 2000
4. Check Geopify API status and quota

## Future Enhancements

- Real GPS integration
- Multiple transport types (bus, train, metro)
- Traffic simulation
- Weather effects on routes
- Advanced fare structures
- Route optimization
- Passenger behavior modeling
