'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Users, 
  DollarSign,
  Navigation,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  RefreshCw,
  Activity,
  CreditCard,
  Clock,
  Target,
  AlertCircle,
  PieChart,
  LineChart
} from 'lucide-react';
import { apiService } from '@/lib/api';

interface AnalyticsData {
  totalUsers: number;
  totalRevenue: number;
  totalTrips: number;
  activeUsers: number;
  todayTrips: number;
  monthlyGrowth: {
    revenue: number;
    trips: number;
    users: number;
  };
  recentActivity: any[];
  lastUpdated: string;
}

interface RouteAnalytics {
  popularRoutes: Array<{
    route: string;
    count: number;
    totalRevenue: number;
    averageFare: number;
    percentage: number;
  }>;
  totalRoutes: number;
  totalTrips: number;
}

interface RevenueAnalytics {
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    trips: number;
  }>;
  totalRevenue: number;
  totalTrips: number;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    tripCount: number;
  }>;
  balanceDistribution: {
    '0-100': number;
    '101-500': number;
    '501-1000': number;
    '1000+': number;
  };
  averageBalance: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [routeData, setRouteData] = useState<RouteAnalytics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
  const [userData, setUserData] = useState<UserAnalytics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'users' | 'routes'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('Auto-refreshing analytics data...');
        loadAnalyticsData();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading analytics data...');
      
      // Load all analytics data in parallel
      const [overviewResponse, routeResponse, revenueResponse, userResponse] = await Promise.all([
        apiService.getAnalyticsOverview(),
        apiService.getRouteAnalytics(),
        apiService.getRevenueAnalytics(),
        apiService.getUserAnalytics()
      ]);
      
      console.log('Analytics overview response:', overviewResponse);
      
      if (overviewResponse.success) {
        setAnalyticsData(overviewResponse.data);
      } else {
        throw new Error('Failed to load analytics overview');
      }
      
      if (routeResponse.success) {
        setRouteData(routeResponse.data);
      }
      
      if (revenueResponse.success) {
        setRevenueData(revenueResponse.data);
      }
      
      if (userResponse.success) {
        setUserData(userResponse.data);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAnalyticsData();
  };

  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Analytics</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
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
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time system analytics and insights
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
              >
                <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
                {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
              </Button>
              <span className="text-sm text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'revenue', label: 'Revenue', icon: DollarSign },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'routes', label: 'Routes', icon: MapPin }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {analyticsData && (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                        <p className="text-2xl font-bold">{analyticsData.totalUsers.toLocaleString()}</p>
                        <div className="flex items-center mt-1">
                          <Users className="h-3 w-3 text-blue-600 mr-1" />
                          <span className="text-xs text-blue-600">
                            {analyticsData.activeUsers} active now
                          </span>
                        </div>
                      </div>
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-green-600">৳{analyticsData.totalRevenue.toLocaleString()}</p>
                        <div className="flex items-center mt-1">
                          {analyticsData.monthlyGrowth.revenue >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                          )}
                          <span className={`text-xs ${analyticsData.monthlyGrowth.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {analyticsData.monthlyGrowth.revenue >= 0 ? '+' : ''}{analyticsData.monthlyGrowth.revenue.toFixed(1)}% this month
                          </span>
                        </div>
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
                        <p className="text-sm font-medium text-muted-foreground">Monthly Trips</p>
                        <p className="text-2xl font-bold">{analyticsData.totalTrips.toLocaleString()}</p>
                        <div className="flex items-center mt-1">
                          {analyticsData.monthlyGrowth.trips >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                          )}
                          <span className={`text-xs ${analyticsData.monthlyGrowth.trips >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {analyticsData.monthlyGrowth.trips >= 0 ? '+' : ''}{analyticsData.monthlyGrowth.trips.toFixed(1)}% this month
                          </span>
                        </div>
                      </div>
                      <div className="bg-purple-100 p-2 rounded-full">
                        <Navigation className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold">{analyticsData.activeUsers.toLocaleString()}</p>
                        <div className="flex items-center mt-1">
                          <Activity className="h-3 w-3 text-orange-600 mr-1" />
                          <span className="text-xs text-orange-600">
                            Currently traveling
                          </span>
                        </div>
                      </div>
                      <div className="bg-orange-100 p-2 rounded-full">
                        <Activity className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Travel Activity</CardTitle>
                  <CardDescription>Latest completed journeys</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.recentActivity.slice(0, 8).map((activity, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                        <div className="bg-blue-100 p-2 rounded-full">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {activity.user_profile?.name || 'User'} • Card: {activity.user_profile?.card_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.pick_point} → {activity.drop_point}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">৳{activity.total_cost?.toFixed(0) || '0'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.travel_time).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && revenueData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue Trends</CardTitle>
                  <CardDescription>Revenue performance over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueData.monthlyRevenue.map((month, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{month.month}</p>
                          <p className="text-sm text-muted-foreground">{month.trips} trips</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">৳{month.revenue.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            ৳{(month.revenue / (month.trips || 1)).toFixed(0)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Summary</CardTitle>
                  <CardDescription>Overall revenue statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">Total Revenue (6 months)</p>
                        <p className="text-sm text-green-700">All completed trips</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        ৳{revenueData.totalRevenue.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900">Total Trips</p>
                        <p className="text-sm text-blue-700">Completed journeys</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {revenueData.totalTrips.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-900">Average Fare</p>
                        <p className="text-sm text-purple-700">Per trip revenue</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">
                        ৳{(revenueData.totalRevenue / revenueData.totalTrips).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && userData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Statistics</CardTitle>
                  <CardDescription>User engagement and activity metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900">Total Users</p>
                        <p className="text-sm text-blue-700">Registered accounts</p>
                      </div>
                      <p className="text-xl font-bold text-blue-600">{userData.totalUsers}</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">Active Users</p>
                        <p className="text-sm text-green-700">Traveled this week</p>
                      </div>
                      <p className="text-xl font-bold text-green-600">{userData.activeUsers}</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-900">New This Month</p>
                        <p className="text-sm text-purple-700">New registrations</p>
                      </div>
                      <p className="text-xl font-bold text-purple-600">{userData.newUsersThisMonth}</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-900">Average Balance</p>
                        <p className="text-sm text-orange-700">Per user account</p>
                      </div>
                      <p className="text-xl font-bold text-orange-600">৳{userData.averageBalance}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Users</CardTitle>
                  <CardDescription>Most frequent travelers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userData.topUsers.slice(0, 5).map((user, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{user.tripCount} trips</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Balance Distribution</CardTitle>
                  <CardDescription>User balance ranges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(userData.balanceDistribution).map(([range, count]) => (
                      <div key={range} className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-sm text-muted-foreground">৳{range}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Routes Tab */}
          {activeTab === 'routes' && routeData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Popular Routes</CardTitle>
                  <CardDescription>Most frequently used transportation routes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {routeData.popularRoutes.slice(0, 8).map((route, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{route.route}</p>
                          <p className="text-xs text-muted-foreground">
                            {route.count} trips • ৳{route.averageFare.toFixed(0)} avg fare
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            {route.percentage.toFixed(1)}%
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            ৳{route.totalRevenue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Route Statistics</CardTitle>
                  <CardDescription>Overall route performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900">Total Routes</p>
                        <p className="text-sm text-blue-700">Unique route combinations</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{routeData.totalRoutes}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">Most Popular Route</p>
                        <p className="text-sm text-green-700">{routeData.popularRoutes[0]?.route}</p>
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        {routeData.popularRoutes[0]?.count} trips
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-900">Total Trips</p>
                        <p className="text-sm text-purple-700">All route combinations</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">{routeData.totalTrips}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System Insights - Show on all tabs */}
          <Card>
            <CardHeader>
              <CardTitle>System Insights</CardTitle>
              <CardDescription>AI-powered insights and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.monthlyGrowth.revenue > 0 && (
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Revenue Growth</h4>
                      <p className="text-sm text-green-700">
                        Monthly revenue increased by {analyticsData.monthlyGrowth.revenue.toFixed(1)}%. 
                        User adoption is accelerating.
                      </p>
                    </div>
                  </div>
                )}

                {routeData && routeData.popularRoutes[0] && (
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-900">Popular Route</h4>
                      <p className="text-sm text-orange-700">
                        {routeData.popularRoutes[0].route} accounts for {routeData.popularRoutes[0].percentage.toFixed(1)}% of all trips.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Live Monitoring</h4>
                    <p className="text-sm text-blue-700">
                      System is operating normally with {analyticsData.activeUsers} users currently traveling.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}