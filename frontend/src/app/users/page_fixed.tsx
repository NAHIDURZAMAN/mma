'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search, 
  UserCheck, 
  CreditCard, 
  Mail, 
  Phone,
  Calendar,
  Wallet,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { apiService } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { User, TravelHistory } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [travelHistory, setTravelHistory] = useState<{ [userId: string]: TravelHistory[] }>({});
  const [currentTravels, setCurrentTravels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadCurrentTravels();
    
    // Setup WebSocket for real-time updates
    wsService.connect();
    wsService.on('user_update', (data: any) => {
      setUsers(prev => prev.map(user => 
        user.user_id === data.user_id ? { ...user, ...data } : user
      ));
    });

    wsService.on('travel_update', (data: any) => {
      loadCurrentTravels(); // Reload current travels
      if (data.user_id) {
        loadUserTravelHistory(data.user_id); // Reload specific user's history
      }
    });

    return () => {
      wsService.off('user_update');
      wsService.off('travel_update');
    };
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.card_id.includes(searchTerm) ||
        (user.phone && user.phone.includes(searchTerm))
      );
      setFilteredUsers(filtered);
    }
  }, [users, searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users from API...');
      const response = await apiService.getUsers();
      console.log('API Response:', response);
      if (response.success) {
        console.log('Users data:', response.data);
        console.log('Number of users:', response.data.length);
        setUsers(response.data);
      } else {
        console.error('API call failed:', response);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentTravels = async () => {
    try {
      const response = await apiService.getCurrentTravels();
      if (response.success) {
        setCurrentTravels(response.data);
      }
    } catch (error) {
      console.error('Failed to load current travels:', error);
    }
  };

  const loadUserTravelHistory = async (userId: string) => {
    try {
      const response = await apiService.getTravelHistory(userId);
      if (response.success) {
        setTravelHistory(prev => ({
          ...prev,
          [userId]: response.data
        }));
      }
    } catch (error) {
      console.error('Failed to load travel history:', error);
    }
  };

  const handleUserClick = async (userId: string) => {
    if (selectedUser === userId) {
      setSelectedUser(null);
    } else {
      setSelectedUser(userId);
      if (!travelHistory[userId]) {
        await loadUserTravelHistory(userId);
      }
    }
  };

  const getCurrentTravel = (userId: number | string) => {
    return currentTravels.find(travel => travel.user_id === userId || travel.user_id === userId.toString());
  };

  const getUserTravelHistory = (userId: string) => {
    return travelHistory[userId] || [];
  };

  const getStatusColor = (balance: number) => {
    if (balance >= 50) return 'default';
    if (balance >= 10) return 'secondary';
    return 'destructive';
  };

  const getStatusText = (balance: number) => {
    if (balance >= 50) return 'Active';
    if (balance >= 10) return 'Low Balance';
    return 'Insufficient';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage registered users and their RFID cards.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.balance >= 10).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Wallet className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Total Balance</p>
                <p className="text-2xl font-bold">
                  ৳{users.reduce((sum, u) => sum + u.balance, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Currently Traveling</p>
                <p className="text-2xl font-bold">{currentTravels.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
          <CardDescription>
            Search by name, email, phone, or card ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Registered users with their RFID card information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const currentTravel = getCurrentTravel(user.user_id);
              const userHistory = getUserTravelHistory(user.user_id.toString());
              const isExpanded = selectedUser === user.user_id.toString();
              
              return (
                <div key={user.user_id} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleUserClick(user.user_id.toString())}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="h-3 w-3" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {/* Current Travel Status */}
                        {currentTravel && (
                          <div className="mt-2 flex items-center space-x-2">
                            <Badge variant="default" className="bg-green-500">
                              <Activity className="h-3 w-3 mr-1" />
                              Traveling
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              From: {currentTravel.pick_point}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{user.card_id}</span>
                        </div>
                        <div className="flex items-center justify-end space-x-2 mt-1">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">৳{user.balance}</span>
                        </div>
                      </div>
                      <Badge variant={getStatusColor(user.balance)}>
                        {getStatusText(user.balance)}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded Travel Details */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4">
                      <div className="space-y-4">
                        {/* Current Travel Details */}
                        {currentTravel && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg flex items-center space-x-2">
                                <Activity className="h-5 w-5 text-green-500" />
                                <span>Current Journey</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <div className="flex items-center space-x-2 text-sm">
                                    <MapPin className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium">Entry Point:</span>
                                    <span>{currentTravel.pick_point}</span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm mt-2">
                                    <Clock className="h-4 w-4 text-orange-500" />
                                    <span className="font-medium">Started:</span>
                                    <span>{new Date(currentTravel.created_at).toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-green-600">
                                    ৳{user.balance}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Current Balance</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Recent Travel History */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-5 w-5 text-blue-500" />
                                <span>Recent Travel History</span>
                              </div>
                              {userHistory.length > 0 && (
                                <Badge variant="secondary">{userHistory.length} trips</Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {userHistory.length > 0 ? (
                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                {userHistory.slice(0, 5).map((trip) => (
                                  <div key={trip.travel_id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex items-center space-x-2">
                                        <MapPin className="h-4 w-4 text-green-500" />
                                        <span className="text-sm font-medium">{trip.pick_point}</span>
                                      </div>
                                      {trip.drop_point && (
                                        <>
                                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                          <div className="flex items-center space-x-2">
                                            <MapPin className="h-4 w-4 text-red-500" />
                                            <span className="text-sm font-medium">{trip.drop_point}</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="flex items-center space-x-2">
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                        <span className="font-semibold text-red-600">৳{trip.total_cost}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(trip.travel_time).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No travel history available</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No users found matching your search' : 'No users registered'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
