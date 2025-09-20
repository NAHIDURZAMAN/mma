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
  TrendingDown,
  Activity,
  Navigation,
  History,
  Bus,
  LogOut,
  Shield,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  X,
  Ban,
  Unlock
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiService } from '@/lib/api';

interface User {
  user_id: number;
  name: string;
  email: string;
  phone?: string;
  card_id: string;
  balance: number;
  created_at: string;
  is_blocked?: number | boolean;
  blocked_at?: string;
  blocked_reason?: string;
  blocked_by?: string;
  unblocked_at?: string;
  unblocked_by?: string;
  unblock_reason?: string;
}

interface CurrentTravel {
  user_id: number;
  pick_point: string;
  current_longitude: number;
  current_latitude: number;
  created_at: string;
  user_profile: {
    name: string;
    email: string;
    card_id: string;
  };
}

interface TravelHistory {
  user_id: number;
  pick_point: string;
  drop_point: string;
  total_cost: number;
  remaining_balance: number;
  travel_time: string;
  user_profile?: {
    name: string;
    email: string;
    card_id: string;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [currentTravel, setCurrentTravel] = useState<CurrentTravel[]>([]);
  const [userTravelHistory, setUserTravelHistory] = useState<{[key: number]: TravelHistory[]}>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<{[key: number]: boolean}>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  const [blockingCardId, setBlockingCardId] = useState<string | null>(null);
  const [blockingReason, setBlockingReason] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [unblockingCardId, setUnblockingCardId] = useState<string | null>(null);
  const [unblockingReason, setUnblockingReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io('http://localhost:2000');
    setSocket(newSocket);

    // Listen for real-time updates
    newSocket.on('rfid_scan', (data) => {
      console.log('RFID scan detected:', data);
      loadCurrentTravel(); // Refresh current travel status
      loadUsers(); // Refresh user data (balance might have changed)
    });

    newSocket.on('user_update', (data) => {
      console.log('User update:', data);
      loadUsers(); // Refresh user data
    });

    newSocket.on('travel_update', (data) => {
      console.log('Travel update:', data);
      loadCurrentTravel(); // Refresh current travel status
    });

    loadUsers();
    loadCurrentTravel();

    return () => {
      newSocket.close();
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
      console.log('Fetching users...');
      
      // Direct fetch to avoid any apiService issues
      const response = await fetch('http://localhost:2000/api/users');
      const data = await response.json();
      
      console.log('API Response:', data);
      
      if (data.success && data.data) {
        console.log('Setting users:', data.data.length);
        setUsers(data.data);
        setFilteredUsers(data.data);
      } else {
        console.error('API response not successful:', data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentTravel = async () => {
    try {
      console.log('Fetching current travel...');
      const response = await fetch('http://localhost:2000/api/current-travel');
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('Current travel users:', data.data.length);
        setCurrentTravel(data.data);
      } else {
        console.error('Failed to load current travel:', data);
      }
    } catch (error) {
      console.error('Failed to load current travel:', error);
    }
  };

  const loadTravelHistory = async (userId: number) => {
    try {
      console.log('Fetching travel history for user:', userId);
      const response = await fetch(`http://localhost:2000/api/travel-history?user_id=${userId}&limit=10`);
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('Travel history:', data.data.length);
        setUserTravelHistory(prev => ({
          ...prev,
          [userId]: data.data
        }));
      } else {
        console.error('Failed to load travel history:', data);
      }
    } catch (error) {
      console.error('Failed to load travel history:', error);
    }
  };

  const isUserOnline = (userId: number) => {
    return currentTravel.some(travel => travel.user_id === userId);
  };

  const getCurrentTravelInfo = (userId: number) => {
    return currentTravel.find(travel => travel.user_id === userId);
  };

  const toggleHistoryExpansion = (userId: number) => {
    setExpandedHistory(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));

    // Load travel history if expanding and not already loaded
    if (!expandedHistory[userId] && !userTravelHistory[userId]) {
      loadTravelHistory(userId);
    }
  };

  const getStatusColor = (balance: number) => {
    if (balance >= 50) return 'default';
    if (balance >= 20) return 'secondary';
    return 'destructive';
  };

  const getStatusText = (balance: number) => {
    if (balance >= 50) return 'Active';
    if (balance >= 20) return 'Low Balance';
    return 'Insufficient';
  };

  const handleUserClick = (userId: string) => {
    setSelectedUser(selectedUser === userId ? null : userId);
  };

  const handleBlockCard = async (user: User) => {
    if (!blockingReason.trim()) {
      alert('Please provide a reason for blocking the card');
      return;
    }

    setActionLoading(true);
    try {
      const response = await apiService.blockCard({
        userId: user.user_id.toString(),
        cardId: user.card_id,
        reason: blockingReason.trim(),
        blockedBy: 'ADMIN_PANEL'
      });

      if (response.success) {
        // Update user in local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.user_id === user.user_id 
              ? { ...u, is_blocked: true, blocked_reason: blockingReason.trim() }
              : u
          )
        );

        // Close dialog and reset state
        setShowBlockDialog(false);
        setBlockingCardId(null);
        setBlockingReason('');

        alert(`Card ${user.card_id} has been blocked successfully. Email notification sent to ${user.email}.`);
      } else {
        alert(`Failed to block card: ${response.message}`);
      }
    } catch (error) {
      console.error('Error blocking card:', error);
      alert('Failed to block card. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCard = async (user: User) => {
    if (!unblockingReason.trim()) {
      alert('Please provide a reason for unblocking the card');
      return;
    }

    setActionLoading(true);
    try {
      const response = await apiService.unblockCard({
        userId: user.user_id.toString(),
        cardId: user.card_id,
        reason: unblockingReason.trim(),
        unblockedBy: 'ADMIN_PANEL'
      });

      if (response.success) {
        // Update user in local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.user_id === user.user_id 
              ? { ...u, is_blocked: false, unblock_reason: unblockingReason.trim() }
              : u
          )
        );

        // Close dialog and reset state
        setShowUnblockDialog(false);
        setUnblockingCardId(null);
        setUnblockingReason('');

        alert(`Card ${user.card_id} has been unblocked successfully. Email notification sent to ${user.email}.`);
      } else {
        alert(`Failed to unblock card: ${response.message}`);
      }
    } catch (error) {
      console.error('Error unblocking card:', error);
      alert('Failed to unblock card. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openBlockDialog = (user: User) => {
    setBlockingCardId(user.card_id);
    setBlockingReason('');
    setShowBlockDialog(true);
  };

  const openUnblockDialog = (user: User) => {
    setUnblockingCardId(user.card_id);
    setUnblockingReason('');
    setShowUnblockDialog(true);
  };

  const isCardBlocked = (user: User) => {
    return user.is_blocked === 1 || user.is_blocked === true;
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
          Manage registered users and their RFID cards from user_profile table.
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
                  {users.filter(u => !isCardBlocked(u) && u.balance >= 20).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bus className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Online (In Bus)</p>
                <p className="text-2xl font-bold text-green-600">
                  {currentTravel.length}
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
                  ৳{users.reduce((sum, u) => sum + u.balance, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">RFID Cards</p>
                <p className="text-2xl font-bold">{users.length}</p>
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
            All users from the user_profile database table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isExpanded = selectedUser === user.user_id.toString();
                
                return (
                  <div key={user.user_id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user.user_id.toString())}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center relative ${
                          isUserOnline(user.user_id) ? 'bg-green-100' : 'bg-primary/10'
                        }`}>
                          <Users className={`h-6 w-6 ${
                            isUserOnline(user.user_id) ? 'text-green-600' : 'text-primary'
                          }`} />
                          {isUserOnline(user.user_id) && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <Bus className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{user.name}</h3>
                            {isUserOnline(user.user_id) && (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                <Activity className="h-3 w-3 mr-1" />
                                Online
                              </Badge>
                            )}
                          </div>
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
                          {isUserOnline(user.user_id) && getCurrentTravelInfo(user.user_id) && (
                            <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>Traveling from: {getCurrentTravelInfo(user.user_id)?.pick_point}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{user.card_id}</span>
                            {isCardBlocked(user) && (
                              <div title="Card is blocked">
                                <Shield className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-end space-x-2 mt-1">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">৳{user.balance.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <Badge variant={getStatusColor(user.balance)}>
                            {getStatusText(user.balance)}
                          </Badge>
                          {isCardBlocked(user) ? (
                            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
                              <Shield className="h-3 w-3 mr-1" />
                              BLOCKED
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              ACTIVE
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded User Details */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2">User Information</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">User ID:</span>
                                <span>{user.user_id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Name:</span>
                                <span>{user.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Email:</span>
                                <span>{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Phone:</span>
                                  <span>{user.phone}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Registered:</span>
                                <span>{new Date(user.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold mb-2">RFID & Status</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Card ID:</span>
                                <span className="font-mono">{user.card_id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Balance:</span>
                                <span className="font-semibold text-green-600">৳{user.balance.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Account Status:</span>
                                <Badge variant={getStatusColor(user.balance)}>
                                  {getStatusText(user.balance)}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Travel Status:</span>
                                <Badge variant={isUserOnline(user.user_id) ? "default" : "secondary"} className={
                                  isUserOnline(user.user_id) ? "bg-green-500 hover:bg-green-600" : ""
                                }>
                                  {isUserOnline(user.user_id) ? (
                                    <>
                                      <Bus className="h-3 w-3 mr-1" />
                                      In Transit
                                    </>
                                  ) : (
                                    <>
                                      <LogOut className="h-3 w-3 mr-1" />
                                      Offline
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Card Status:</span>
                                {isCardBlocked(user) ? (
                                  <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
                                    <Shield className="h-3 w-3 mr-1" />
                                    BLOCKED
                                  </Badge>
                                ) : (
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    ACTIVE
                                  </Badge>
                                )}
                              </div>
                              {isCardBlocked(user) && user.blocked_reason && (
                                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                                  <div className="flex items-center text-red-700 text-xs mb-1">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    <span>Blocked Details</span>
                                  </div>
                                  <div className="text-xs text-red-600">
                                    <div>Reason: {user.blocked_reason}</div>
                                    {user.blocked_at && (
                                      <div>Blocked: {new Date(user.blocked_at).toLocaleString()}</div>
                                    )}
                                    {user.blocked_by && (
                                      <div>By: {user.blocked_by}</div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {isUserOnline(user.user_id) && getCurrentTravelInfo(user.user_id) && (
                                <div className="mt-2 p-2 bg-green-50 rounded border">
                                  <div className="flex items-center text-green-700 text-xs mb-1">
                                    <Navigation className="h-3 w-3 mr-1" />
                                    <span>Current Journey</span>
                                  </div>
                                  <div className="text-xs text-green-600">
                                    <div>From: {getCurrentTravelInfo(user.user_id)?.pick_point}</div>
                                    <div>Started: {new Date(getCurrentTravelInfo(user.user_id)?.created_at || '').toLocaleTimeString()}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Security Controls */}
                          <div>
                            <h4 className="font-semibold mb-2">Card Security</h4>
                            <div className="space-y-3">
                              {isCardBlocked(user) ? (
                                <>
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center mb-2">
                                      <Shield className="h-4 w-4 text-red-600 mr-2" />
                                      <span className="font-medium text-red-900">Card Blocked</span>
                                    </div>
                                    <p className="text-xs text-red-700 mb-3">
                                      This card cannot be used for transportation services.
                                    </p>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openUnblockDialog(user);
                                      }}
                                      size="sm"
                                      variant="outline"
                                      className="w-full border-green-300 text-green-700 hover:bg-green-50"
                                    >
                                      <Unlock className="h-3 w-3 mr-1" />
                                      Unblock Card
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center mb-2">
                                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                      <span className="font-medium text-green-900">Card Active</span>
                                    </div>
                                    <p className="text-xs text-green-700 mb-3">
                                      Card is functioning normally and can be used for all services.
                                    </p>
                                  </div>
                                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex items-center mb-2">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                                      <span className="font-medium text-yellow-900">Security Action</span>
                                    </div>
                                    <p className="text-xs text-yellow-700 mb-3">
                                      Block this card if it's reported lost or stolen.
                                    </p>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBlockDialog(user);
                                      }}
                                      size="sm"
                                      variant="destructive"
                                      className="w-full"
                                    >
                                      <Ban className="h-3 w-3 mr-1" />
                                      Block Card
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">Travel History</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleHistoryExpansion(user.user_id);
                                }}
                              >
                                <History className="h-3 w-3 mr-1" />
                                {expandedHistory[user.user_id] ? 'Hide' : 'Show'} History
                              </Button>
                            </div>
                            
                            {expandedHistory[user.user_id] && (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {userTravelHistory[user.user_id] ? (
                                  userTravelHistory[user.user_id].length > 0 ? (
                                    userTravelHistory[user.user_id].map((travel, index) => (
                                      <div key={index} className="p-2 bg-white rounded border text-xs">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center text-blue-600">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            <span className="font-medium">Trip #{userTravelHistory[user.user_id].length - index}</span>
                                          </div>
                                          <span className="text-muted-foreground">
                                            {new Date(travel.travel_time).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex items-center text-gray-600">
                                            <span className="text-green-600">From:</span>
                                            <span className="ml-1">{travel.pick_point}</span>
                                          </div>
                                          <div className="flex items-center text-gray-600">
                                            <span className="text-red-600">To:</span>
                                            <span className="ml-1">{travel.drop_point}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-1">
                                            <span className="text-red-500 font-medium">
                                              Fare: ৳{travel.total_cost}
                                            </span>
                                            <span className="text-green-600 font-medium">
                                              Balance: ৳{travel.remaining_balance}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center text-muted-foreground py-4 text-xs">
                                      <History className="h-4 w-4 mx-auto mb-1" />
                                      No travel history found
                                    </div>
                                  )
                                ) : (
                                  <div className="text-center text-muted-foreground py-4 text-xs">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-1"></div>
                                    Loading travel history...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No users found matching your search' : 'No users found'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Total users loaded: {users.length}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Block Card Dialog */}
      {showBlockDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold">Block Card</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to block card: <span className="font-mono font-medium">{blockingCardId}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for blocking <span className="text-red-500">*</span>
              </label>
              <textarea
                value={blockingReason}
                onChange={(e) => setBlockingReason(e.target.value)}
                placeholder="e.g., Card reported lost, Security breach, Suspicious activity..."
                className="w-full p-2 border rounded-md resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {blockingReason.length}/500 characters
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Warning</p>
                  <p className="text-yellow-700">
                    This card will be immediately blocked and cannot be used for any transactions. 
                    An email notification will be sent to the user.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowBlockDialog(false);
                  setBlockingCardId(null);
                  setBlockingReason('');
                }}
                variant="outline"
                className="flex-1"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const user = users.find(u => u.card_id === blockingCardId);
                  if (user) handleBlockCard(user);
                }}
                variant="destructive"
                className="flex-1"
                disabled={actionLoading || !blockingReason.trim()}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Blocking...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Block Card
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Card Dialog */}
      {showUnblockDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <Unlock className="h-6 w-6 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold">Unblock Card</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to unblock card: <span className="font-mono font-medium">{unblockingCardId}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for unblocking <span className="text-red-500">*</span>
              </label>
              <textarea
                value={unblockingReason}
                onChange={(e) => setUnblockingReason(e.target.value)}
                placeholder="e.g., Card found by user, Issue resolved, Investigation completed..."
                className="w-full p-2 border rounded-md resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {unblockingReason.length}/500 characters
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Confirmation</p>
                  <p className="text-green-700">
                    This card will be reactivated and can be used for all transportation services. 
                    An email notification will be sent to the user.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowUnblockDialog(false);
                  setUnblockingCardId(null);
                  setUnblockingReason('');
                }}
                variant="outline"
                className="flex-1"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const user = users.find(u => u.card_id === unblockingCardId);
                  if (user) handleUnblockCard(user);
                }}
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={actionLoading || !unblockingReason.trim()}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Unblocking...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Unblock Card
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
