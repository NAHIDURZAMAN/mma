'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  CheckCircle, 
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  Wallet
} from 'lucide-react';
import { apiService } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { User as UserType } from '@/types';

interface CreateUserResult {
  request: {
    name: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    balance?: number;
  };
  response: {
    success: boolean;
    message: string;
    user?: UserType;
    cardId?: string;
  };
  timestamp: string;
}

export default function UserCreatorPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    password: '',
    balance: 100,
    cardNumber: '',
    cardType: 'regular'
  });
  const [results, setResults] = useState<CreateUserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    // Connect WebSocket for real-time updates
    wsService.connect();

    // Listen for user creation events via WebSocket
    wsService.on('user_created', (data: any) => {
      console.log('User created via WebSocket:', data);
      loadUsers(); // Refresh user list
    });

    wsService.on('user_creation_error', (data: any) => {
      console.error('User creation error:', data);
    });

    // Load existing users
    loadUsers();

    return () => {
      wsService.off('user_created');
      wsService.off('user_creation_error');
    };
  }, []);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiService.getAllUsersAdmin();
      setUsers(response.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      // Try alternative API if the first one fails
      try {
        const fallbackResponse = await apiService.getUsers();
        if (fallbackResponse.success) {
          setUsers(fallbackResponse.data || []);
        }
      } catch (fallbackError) {
        console.error('Failed to load users with fallback:', fallbackError);
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.dob || !formData.address || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Basic phone validation
    if (formData.phone.length < 10) {
      alert('Phone number must be at least 10 digits');
      return;
    }

    setIsLoading(true);

    try {
      const userData = {
        ...formData,
        balance: Number(formData.balance)
      };

      const response = await apiService.createUser(userData);
      
      const result: CreateUserResult = {
        request: userData,
        response,
        timestamp: new Date().toISOString()
      };

      setResults(prev => [result, ...prev.slice(0, 9)]);
      
      // Clear form on success
      if (response.success) {
        setFormData({
          name: '',
          email: '',
          phone: '',
          dob: '',
          address: '',
          password: '',
          balance: 100,
          cardNumber: '',
          cardType: 'regular'
        });
        
        // Refresh users list
        loadUsers();
      }

    } catch (error) {
      console.error('User creation failed:', error);
      const result: CreateUserResult = {
        request: formData,
        response: { 
          success: false, 
          message: error instanceof Error ? error.message : 'User creation failed'
        },
        timestamp: new Date().toISOString()
      };
      setResults(prev => [result, ...prev.slice(0, 9)]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const generateSampleData = () => {
    const sampleUsers = [
      {
        name: 'Ahmed Rahman',
        email: 'ahmed.rahman@example.com',
        phone: '+8801712345678',
        address: 'Dhanmondi, Dhaka'
      },
      {
        name: 'Fatima Khan',
        email: 'fatima.khan@example.com', 
        phone: '+8801823456789',
        address: 'Gulshan, Dhaka'
      },
      {
        name: 'Mohammad Islam',
        email: 'mohammad.islam@example.com',
        phone: '+8801934567890',
        address: 'Uttara, Dhaka'
      }
    ];
    
    const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    setFormData({
      ...formData,
      ...randomUser,
      dob: '1995-01-01',
      password: 'password123',
      cardType: Math.random() > 0.5 ? 'student' : 'regular'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">User Creator</h1>
        <p className="text-muted-foreground">
          Create new users for the Smart Transit system with automatic card ID generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Creation Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5" />
                <span>Create New User</span>
              </CardTitle>
              <CardDescription>
                Fill in the user details below including the RFID card number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name *</label>
                  <Input
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                    <Mail className="h-3 w-3" />
                    <span>Email *</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span>Phone Number *</span>
                  </label>
                  <Input
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>Date of Birth *</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>Address *</span>
                </label>
                <Input
                  placeholder="Enter full address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                  <CreditCard className="h-3 w-3" />
                  <span>RFID Card Number *</span>
                </label>
                <Input
                  placeholder="Enter RFID card number (8-16 characters)"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  maxLength={16}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                  <Badge className="h-3 w-3" />
                  <span>Card Type *</span>
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.cardType}
                  onChange={(e) => handleInputChange('cardType', e.target.value)}
                >
                  <option value="regular">Regular (No Discount)</option>
                  <option value="student">Student (50% Discount)</option>
                  <option value="senior">Senior (30% Discount)</option>
                  <option value="disabled">Disabled (70% Discount)</option>
                  <option value="child">Child (50% Discount)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Password *</label>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center space-x-1">
                    <Wallet className="h-3 w-3" />
                    <span>Initial Balance (BDT)</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100"
                    value={formData.balance}
                    onChange={(e) => handleInputChange('balance', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleCreateUser}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create User
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={generateSampleData}
                  variant="outline"
                  disabled={isLoading}
                >
                  Sample Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Recent Users</span>
              </CardTitle>
              <CardDescription>Latest created users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No users found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first user above
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {users.slice(0, 8).map((user, index) => (
                    <div key={user.user_id || index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-xs flex items-center space-x-1">
                          <CreditCard className="h-3 w-3" />
                          <span>Card: {user.card_id}</span>
                        </p>
                        <p className="text-xs flex items-center space-x-1">
                          <Badge className="h-3 w-3" />
                          <span>Type: {user.card_type || 'regular'}</span>
                          {user.card_type === 'student' && <span className="text-green-600">(50% off)</span>}
                          {user.card_type === 'senior' && <span className="text-blue-600">(30% off)</span>}
                          {user.card_type === 'disabled' && <span className="text-purple-600">(70% off)</span>}
                          {user.card_type === 'child' && <span className="text-orange-600">(50% off)</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={Number(user.balance) < 50 ? 'destructive' : 'default'}>
                          ৳{user.balance}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">ID: {user.user_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Creation Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Creation Results</CardTitle>
                <CardDescription>Recent user creation attempts</CardDescription>
              </div>
              <Button onClick={clearResults} variant="outline" size="sm">
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No creation attempts yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a user to see results here
                  </p>
                </div>
              ) : (
                results.map((result, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 space-y-2 ${
                      result.response.success 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {result.response.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium text-sm">
                          {result.request.name}
                        </span>
                        <Badge variant={result.response.success ? 'default' : 'destructive'}>
                          {result.response.success ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span><strong>Email:</strong> {result.request.email}</span>
                        <span><strong>Phone:</strong> {result.request.phone}</span>
                      </div>
                      
                      {result.response.success && result.response.cardId && (
                        <div className="bg-white p-2 rounded text-xs border">
                          <div className="flex items-center space-x-1">
                            <CreditCard className="h-3 w-3" />
                            <strong>Generated Card ID:</strong> 
                            <span className="font-mono font-bold">{result.response.cardId}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className={`p-2 rounded text-xs ${
                        result.response.success 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <strong>Response:</strong> {result.response.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
