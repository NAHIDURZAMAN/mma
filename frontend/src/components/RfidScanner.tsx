import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Users, MapPin, Wifi, WifiOff } from 'lucide-react';

interface RfidScannerProps {
  onLocationUpdate?: (location: [number, number]) => void;
}

const RfidScanner: React.FC<RfidScannerProps> = ({ onLocationUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [cardNumber, setCardNumber] = useState('');

  useEffect(() => {
    // Check server connection
    checkConnection();
    // Get current passengers
    fetchPassengers();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:2000/api/health');
      if (response.ok) {
        setIsConnected(true);
      }
    } catch (error) {
      setIsConnected(false);
      console.error('RFID server not connected:', error);
    }
  };

  const fetchPassengers = async () => {
    try {
      const response = await fetch('http://localhost:2000/api/passengers');
      if (response.ok) {
        const data = await response.json();
        setPassengers(data.passengers || []);
      }
    } catch (error) {
      console.error('Error fetching passengers:', error);
    }
  };

  const simulateRfidScan = async (scanType: 'entry' | 'exit') => {
    if (!cardNumber.trim()) {
      alert('Please enter a card number');
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch('http://localhost:2000/api/rfid-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rfidCard: cardNumber.trim(),
          scanType,
          busId: 'BUS001'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLastScan(data);
        
        // Update location if card scan was successful and we have location data
        if (data.busLocation && onLocationUpdate && data.action === 'board') {
          onLocationUpdate([data.busLocation.lat, data.busLocation.lng]);
        }
        
        // Refresh passengers list
        fetchPassengers();
        
        // Clear card number after successful scan
        if (data.action !== 'invalid') {
          setCardNumber('');
        }
      } else {
        const error = await response.json();
        alert(`Scan failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error during RFID scan:', error);
      alert('Failed to connect to RFID server');
    } finally {
      setIsScanning(false);
    }
  };

  const updateBusLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const response = await fetch('http://localhost:2000/api/update-bus-location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: 'Current GPS Location',
              busId: 'BUS001'
            }),
          });

          if (response.ok) {
            console.log('Bus location updated');
            // Update the frontend location too
            if (onLocationUpdate) {
              onLocationUpdate([position.coords.latitude, position.coords.longitude]);
            }
          }
        } catch (error) {
          console.error('Error updating bus location:', error);
        }
      });
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-blue-600" />
          RFID Card Scanner
          {isConnected ? (
            <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700">
              <Wifi className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto bg-red-100 text-red-700">
              <WifiOff className="w-3 h-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Card Number Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Number
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Enter RFID card number (e.g., 12345)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isScanning || !isConnected}
          />
        </div>

        {/* Scan Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => simulateRfidScan('entry')}
            disabled={isScanning || !isConnected || !cardNumber.trim()}
            className="flex-1 bg-green-500 hover:bg-green-600"
          >
            {isScanning ? '⏳ Scanning...' : '🚌 Board Bus'}
          </Button>
          <Button
            onClick={() => simulateRfidScan('exit')}
            disabled={isScanning || !isConnected || !cardNumber.trim()}
            className="flex-1 bg-red-500 hover:bg-red-600"
          >
            {isScanning ? '⏳ Scanning...' : '🚪 Exit Bus'}
          </Button>
        </div>

        {/* Update Location Button */}
        <Button
          onClick={updateBusLocation}
          disabled={!isConnected}
          variant="outline"
          className="w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Update Bus Location (GPS)
        </Button>

        {/* Last Scan Result */}
        {lastScan && (
          <div className={`p-3 rounded-lg border ${
            lastScan.action === 'board' ? 'bg-green-50 border-green-200' :
            lastScan.action === 'exit' ? 'bg-blue-50 border-blue-200' :
            'bg-red-50 border-red-200'
          }`}>
            <p className="text-sm font-medium">
              {lastScan.action === 'board' ? '✅ Passenger Boarded' :
               lastScan.action === 'exit' ? '✅ Passenger Exited' :
               '❌ Invalid Scan'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Card: {lastScan.rfidCard}
              {lastScan.fare > 0 && ` • Fare: ৳${lastScan.fare.toFixed(2)}`}
            </p>
          </div>
        )}

        {/* Current Passengers */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Passengers on Bus ({passengers.length})
            </span>
          </div>
          
          {passengers.length > 0 ? (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {passengers.map((passenger, index) => (
                <div key={index} className="text-xs bg-gray-50 p-2 rounded border">
                  <span className="font-medium">Card: {passenger.rfidCard}</span>
                  <span className="text-gray-500 ml-2">
                    {Math.floor(passenger.duration / 60)}m {passenger.duration % 60}s
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No passengers currently on bus</p>
          )}
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              ⚠️ RFID server not connected. Make sure the server is running on port 2000.
            </p>
            <Button
              onClick={checkConnection}
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
            >
              Retry Connection
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RfidScanner;
