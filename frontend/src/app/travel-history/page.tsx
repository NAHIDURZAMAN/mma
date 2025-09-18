'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  MapPin, 
  Clock,
  ArrowRight,
  Calendar,
  Search,
  Filter,
  Navigation,
  DollarSign
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TravelRecord {
  user_id: string;
  pick_point: string;
  drop_point: string;
  total_cost: number;
  remaining_balance: number;
  travel_time: string;
  history_id?: string;
  travel_date?: string;
  user_profile?: {
    name: string;
    email: string;
    card_id: string;
  };
}

export default function TravelHistoryPage() {
  const { user } = useAuth();
  const [travelHistory, setTravelHistory] = useState<TravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTravelHistory();
  }, [user]);

  const loadTravelHistory = async () => {
    if (!user?.user_id) {
      console.log('No user ID available');
      setError('User not authenticated');
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      console.log('Loading travel history for user:', user.user_id);
      const response = await fetch(`http://localhost:2000/api/travel-history/${user.user_id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Travel history API response:', data);
      
      if (data.success && data.data) {
        console.log('Setting travel history:', data.data.length, 'trips');
        setTravelHistory(data.data);
      } else {
        console.error('API response not successful or no data:', data);
        setError(data.message || 'No travel history found');
        setTravelHistory([]); // Clear any existing data
      }
    } catch (error) {
      console.error('Failed to load travel history:', error);
      setError(`Failed to load travel history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTravelHistory([]); // Clear any existing data
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = travelHistory.filter(trip => {
    const matchesSearch = searchTerm === '' || 
      trip.pick_point.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.drop_point.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const totalSpent = travelHistory.reduce((sum, trip) => sum + trip.total_cost, 0);
  const totalTrips = travelHistory.length;
  const averageCost = totalTrips > 0 ? totalSpent / totalTrips : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading your travel history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Travel History</h1>
        <p className="text-muted-foreground">
          View all your past journeys and expenses
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Trips</p>
                <p className="text-2xl font-bold">{totalTrips}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-full">
                <Navigation className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">৳{totalSpent.toFixed(2)}</p>
              </div>
              <div className="bg-red-100 p-2 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Cost</p>
                <p className="text-2xl font-bold text-green-600">৳{averageCost.toFixed(2)}</p>
              </div>
              <div className="bg-green-100 p-2 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  {travelHistory.filter(trip => {
                    const tripDate = new Date(trip.travel_time);
                    const now = new Date();
                    return tripDate.getMonth() === now.getMonth() && 
                           tripDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
              <div className="bg-purple-100 p-2 rounded-full">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm">
                All Trips ({filteredHistory.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Travel History List */}
      <Card>
        <CardHeader>
          <CardTitle>Travel History ({filteredHistory.length})</CardTitle>
          <CardDescription>
            All your travel records with Smart Transit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHistory.length > 0 ? (
            <div className="space-y-4">
              {filteredHistory.map((trip, index) => (
                <div key={`${trip.user_id}-${trip.travel_time}`} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Navigation className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Trip #{filteredHistory.length - index}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(trip.travel_time).toLocaleDateString()} at{' '}
                          {new Date(trip.travel_time).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">৳{trip.total_cost.toFixed(2)}</p>
                      <Badge variant="default">
                        Completed
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="flex items-center space-x-1 text-green-600">
                      <MapPin className="h-4 w-4" />
                      <span>{trip.pick_point}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center space-x-1 text-red-600">
                      <MapPin className="h-4 w-4" />
                      <span>{trip.drop_point}</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-muted-foreground">
                    Balance After Trip: ৳{trip.remaining_balance.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? 'No trips match your search' : 'No travel history yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Your journey history will appear here after your first trip with Smart Transit'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}