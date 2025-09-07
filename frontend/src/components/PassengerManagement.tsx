'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  MapPin, 
  Clock, 
  CreditCard, 
  Mail,
  Phone,
  Navigation,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Passenger {
  user_id: string;
  pick_point: string;
  current_latitude: string;
  current_longitude: string;
  created_at: string;
  user_profile: {
    name: string;
    email: string;
    card_id: string;
    balance: number;
  };
}

interface PassengerManagementProps {
  isSimulationRunning: boolean;
}

export default function PassengerManagement({ isSimulationRunning }: PassengerManagementProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfidScanResult, setRfidScanResult] = useState<any>(null);

  // Simulate RFID card scan
  const simulateRFIDScan = async (cardId: string, location: string = 'City Terminal') => {
    try {
      const response = await fetch('http://localhost:2000/api/rfid/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: cardId,
          device_id: 'SIM_001',
          location: location,
          latitude: 23.8103,
          longitude: 90.4125
        })
      });

      const result = await response.json();
      setRfidScanResult(result);
      
      // Auto-hide result after 5 seconds
      setTimeout(() => setRfidScanResult(null), 5000);
      
      // Refresh passenger list
      fetchCurrentPassengers();
      
    } catch (error) {
      console.error('RFID scan simulation error:', error);
      setRfidScanResult({
        success: false,
        message: 'Connection error - Make sure backend server is running',
        action: 'error_beep'
      });
    }
  };

  // Fetch current passengers
  const fetchCurrentPassengers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:2000/api/current-travel');
      const data = await response.json();
      
      if (data.success) {
        setPassengers(data.data || []);
        setError(null);
      } else {
        setError('Failed to fetch passenger data');
      }
    } catch (error) {
      console.error('Error fetching passengers:', error);
      setError('Connection error - Make sure backend server is running on port 2000');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh passenger data
  useEffect(() => {
    fetchCurrentPassengers();
    
    const interval = setInterval(fetchCurrentPassengers, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const testCards = [
    { id: '520028E289', name: 'Abdul Rahman' },
    { id: '520028F91B', name: 'Fatema Khatun' },
    { id: '52002925B2', name: 'Mohammad Karim' },
    { id: '4400309616', name: 'Rashida Begum' },
    { id: '4400306E65', name: 'Hasan Ali' }
  ];

  return (
    <div className="space-y-6">
      {/* RFID Scan Result */}
      {rfidScanResult && (
        <Card className={`border-2 ${rfidScanResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {rfidScanResult.success ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <p className={`font-semibold ${rfidScanResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {rfidScanResult.message}
                </p>
                {rfidScanResult.display && (
                  <p className="text-sm text-gray-600">
                    {Array.isArray(rfidScanResult.display) ? rfidScanResult.display.join(' | ') : rfidScanResult.display}
                  </p>
                )}
                {rfidScanResult.user && (
                  <p className="text-sm text-gray-600">
                    User: {rfidScanResult.user.name} | Balance: ৳{rfidScanResult.user.balance}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passenger Management Header */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-blue-600" />
            Passenger Management
            <Badge variant="secondary" className="ml-auto">
              {passengers.length} Passenger{passengers.length !== 1 ? 's' : ''} On Board
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* RFID Simulation Controls */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              RFID Card Scanner Simulation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {testCards.map((card) => (
                <Button
                  key={card.id}
                  variant="outline"
                  size="sm"
                  onClick={() => simulateRFIDScan(card.id)}
                  className="text-left justify-start"
                >
                  <span className="font-mono text-xs mr-2">{card.id}</span>
                  {card.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 Click any card to simulate RFID scan. First scan starts journey, second scan ends it.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Connection Error</span>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchCurrentPassengers}
                className="mt-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                Retry Connection
              </Button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">🔄</div>
              <p className="text-gray-600">Loading passenger data...</p>
            </div>
          ) : passengers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🚌</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Passengers Currently On Board</h3>
              <p className="text-gray-500">Use the RFID scanner simulation above to add passengers</p>
            </div>
          ) : (
            <div className="space-y-4">
              {passengers.map((passenger) => (
                <Card key={passenger.user_id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Passenger Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {passenger.user_profile.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">{passenger.user_profile.name}</h4>
                            <p className="text-xs text-gray-500 font-mono">{passenger.user_profile.card_id}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-3 w-3" />
                            {passenger.user_profile.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CreditCard className="h-3 w-3 text-green-600" />
                            <span className="font-semibold text-green-600">
                              ৳{passenger.user_profile.balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Journey Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-blue-600" />
                          <span className="font-medium">Boarded at:</span>
                        </div>
                        <p className="text-sm text-gray-700 pl-5">{passenger.pick_point}</p>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-orange-600" />
                          <span className="font-medium">Journey Time:</span>
                        </div>
                        <p className="text-sm text-gray-700 pl-5">
                          {Math.floor((Date.now() - new Date(passenger.created_at).getTime()) / 60000)} minutes
                        </p>
                      </div>

                      {/* Location & Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Navigation className="h-3 w-3 text-purple-600" />
                          <span className="font-medium">Location:</span>
                        </div>
                        <p className="text-xs text-gray-600 font-mono pl-5">
                          {parseFloat(passenger.current_latitude).toFixed(4)}, {parseFloat(passenger.current_longitude).toFixed(4)}
                        </p>
                        
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => simulateRFIDScan(passenger.user_profile.card_id, 'Destination Terminal')}
                            className="w-full border-green-300 text-green-700 hover:bg-green-50"
                          >
                            Complete Journey
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
