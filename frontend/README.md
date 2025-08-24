# Smart Transit RFID Management System

A modern Next.js frontend application for managing an RFID-based transit system with real-time Arduino ESP8266 integration.

## Features

- **Real-time Dashboard**: Monitor RFID scanner activity with WebSocket connections
- **User Management**: View and manage registered users and their RFID cards
- **Live Monitoring**: Real-time feed of RFID scan events with success/failure status
- **RFID Simulator**: Test RFID card scans without physical hardware
- **WebSocket Integration**: Real-time updates from Arduino ESP8266 devices
- **Modern UI**: Built with Next.js 14, TypeScript, and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Backend Integration**: RESTful API with Supabase database
- **Hardware**: Arduino ESP8266 with RFID-RC522 module

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see `smart transit` folder)
- Supabase database configured

### Installation

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env.local` file:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:2000
   NEXT_PUBLIC_WS_URL=http://localhost:2000
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## Backend Setup

### Start the Enhanced Backend with WebSocket Support

1. **Navigate to the backend directory:**

   ```bash
   cd "smart transit"
   ```

2. **Install Socket.IO:**

   ```bash
   npm install socket.io --legacy-peer-deps
   ```

3. **Start the enhanced server:**
   ```bash
   node openweb-websocket.js
   ```

The backend will be available at `http://localhost:2000` with WebSocket support enabled.

## Arduino ESP8266 Setup

The Arduino code (`Arduino/code/smart-transit-rfid.ino`) is already configured to work with the backend. Make sure:

1. **WiFi credentials match** the backend configuration:

   - SSID: "Tushar"
   - Password: "12345678"

2. **Server IP is correct** in the Arduino code:

   - Update `serverHost` to your computer's IP address
   - Port should be `2000`

3. **Hardware connections:**
   - RFID-RC522 module connected via SPI
   - LCD display on I2C address 0x27
   - Servo motor on pin D7
   - Buzzer on pin D8

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx       # Root layout with navigation
│   │   ├── page.tsx         # Dashboard page
│   │   ├── users/           # User management page
│   │   ├── monitor/         # Real-time monitoring page
│   │   └── simulator/       # RFID simulator page
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── Dashboard.tsx    # Main dashboard component
│   │   └── Navigation.tsx   # Side navigation
│   ├── lib/
│   │   ├── api.ts          # API service functions
│   │   ├── websocket.ts    # WebSocket service
│   │   └── utils.ts        # Utility functions
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── public/                 # Static assets
├── package.json
└── README.md
```

## API Endpoints

The frontend integrates with these backend endpoints:

- `GET /api/health` - System health check
- `GET /api/users` - Get all registered users
- `POST /api/rfid/scan` - RFID card scan (used by Arduino and simulator)
- `GET /api/arduino/config` - Arduino configuration
- WebSocket events: `rfid_scan`, `user_update`, `travel_update`

## Usage

### Dashboard

- Overview of system status
- Real-time connection status
- Recent RFID scan statistics
- User management shortcuts

### Users Page

- View all registered users
- Search and filter users
- Real-time balance updates
- User statistics

### Monitor Page

- Live feed of RFID scan events
- System health monitoring
- WebSocket connection status
- Event filtering and clearing

### Simulator Page

- Test RFID card scans without hardware
- Quick user selection
- Custom location and device settings
- Simulation result history

## WebSocket Events

The application listens for these real-time events:

- **`rfid_scan`**: New RFID card scan from Arduino or simulator
- **`user_update`**: User balance or status changes
- **`travel_update`**: Travel start/end events
- **`connection`**: WebSocket connection status changes

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Hardware Integration

The frontend works seamlessly with the Arduino ESP8266 RFID scanner:

1. **Arduino scans RFID card**
2. **HTTP POST to `/api/rfid/scan`**
3. **Backend processes scan and updates database**
4. **WebSocket broadcasts event to frontend**
5. **Frontend updates in real-time**

## Troubleshooting

### WebSocket Connection Issues

- Ensure backend is running with WebSocket support (`openweb-websocket.js`)
- Check firewall settings for port 2000
- Verify CORS configuration in backend

### API Connection Issues

- Confirm backend server is running on port 2000
- Check environment variables in `.env.local`
- Verify network connectivity

### Arduino Issues

- Check WiFi credentials in Arduino code
- Ensure server IP address is correct
- Verify hardware connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of an educational smart transit system demonstration.
