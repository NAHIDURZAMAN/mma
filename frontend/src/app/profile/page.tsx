'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Phone,
  CreditCard,
  Calendar,
  MapPin,
  Edit3,
  Save,
  X,
  RefreshCw,
  History,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, refreshUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalSpent: 0,
    lastTrip: null,
    accountAge: 0
  });

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setProfileData({
      name: fullProfile?.name || user?.name || '',
      email: fullProfile?.email || user?.email || '',
      phone: fullProfile?.phone || user?.phone || '',
      address: fullProfile?.address || '',
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:2000/api/profile/${user?.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEditing(false);
        await refreshUser(); // Refresh user data in auth context
        await loadFullProfile(); // Reload profile data
        alert('Profile updated successfully!');
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  // Load full profile data from API
  const loadFullProfile = async () => {
    if (!user?.user_id) return;
    
    try {
      setError(null);
      const response = await fetch(`http://localhost:2000/api/profile/${user.user_id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.user) {
        setFullProfile(data.user);
        setProfileData({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          address: data.user.address || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setError('Failed to load profile data');
    }
  };

  // Load user statistics and recent activity
  const loadUserStats = async () => {
    if (!user?.user_id) return;
    
    try {
      // Load travel history for stats
      const travelResponse = await fetch(`http://localhost:2000/api/travel-history/${user.user_id}?limit=5`);
      const travelData = await travelResponse.json();
      
      if (travelData.success && travelData.data) {
        const trips = travelData.data;
        setRecentActivity(trips);
        
        const totalTrips = trips.length;
        const totalSpent = trips.reduce((sum: number, trip: any) => sum + (trip.total_cost || 0), 0);
        const lastTrip = trips.length > 0 ? trips[0] : null;
        
        // Calculate account age
        const accountAge = fullProfile?.created_at 
          ? Math.floor((Date.now() - new Date(fullProfile.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        setStats({
          totalTrips,
          totalSpent,
          lastTrip,
          accountAge
        });
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  // Refresh all profile data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUser(),
        loadFullProfile(),
        loadUserStats()
      ]);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Load data on component mount and user change
  useEffect(() => {
    if (user?.user_id) {
      loadFullProfile();
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (fullProfile) {
      loadUserStats();
    }
  }, [fullProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !user) {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground">
              Manage your account information and settings
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                {editing ? (
                  <Input
                    value={profileData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                {editing ? (
                  <Input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
                ) : (
                  <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.email}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                {editing ? (
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{fullProfile?.phone || user?.phone || 'Not provided'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                {editing ? (
                  <Input
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter your address"
                  />
                ) : (
                  <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{fullProfile?.address || 'Not provided'}</span>
                  </div>
                )}
              </div>

              {editing && (
                <div className="flex space-x-3 pt-4">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={loading}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Account Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">User ID</span>
                <span className="font-mono text-sm">{user?.user_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Card ID</span>
                <span className="font-mono text-sm">{fullProfile?.card_id || user?.card_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  ৳{user?.balance || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Account Status</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm">
                  {fullProfile?.created_at ? new Date(fullProfile.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              {stats.accountAge > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Account Age</span>
                  <span className="text-sm">{stats.accountAge} days</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Trips</span>
                <Badge variant="outline">{stats.totalTrips}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Spent</span>
                <Badge variant="outline">৳{stats.totalSpent.toFixed(2)}</Badge>
              </div>
              {stats.lastTrip && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Trip</span>
                  <span className="text-sm">
                    {new Date((stats.lastTrip as any).travel_time).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg. Trip Cost</span>
                <Badge variant="outline">
                  ৳{stats.totalTrips > 0 ? (stats.totalSpent / stats.totalTrips).toFixed(2) : '0.00'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/recharge')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Recharge Card
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/recharge-history')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Recharge History
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/travel-history')}
              >
                <History className="h-4 w-4 mr-2" />
                View Travel History
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/dashboard')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest trips</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.slice(0, 3).map((trip: any, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">{trip.pick_point}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(trip.travel_time).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        ৳{trip.total_cost}
                      </Badge>
                    </div>
                  ))}
                  {recentActivity.length > 3 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full"
                      onClick={() => router.push('/travel-history')}
                    >
                      View All History
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}