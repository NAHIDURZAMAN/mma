'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Server,
  HardDrive,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Download,
  Upload,
  BarChart3,
  Clock,
  Zap
} from 'lucide-react';
import { 
  apiService, 
  DatabaseStats, 
  DatabaseTable, 
  PerformanceMetrics,
  BackupInfo,
  OptimizeInfo
} from '@/lib/api';

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (!operationLoading) {
        fetchDatabaseData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [operationLoading]);

  const fetchDatabaseData = async () => {
    try {
      setLoading(true);
      const [statsData, tablesData, performanceData] = await Promise.all([
        apiService.getDatabaseStats(),
        apiService.getDatabaseTables(),
        apiService.getDatabasePerformance()
      ]);
      
      setDbStats(statsData.data);
      setTables(tablesData.data);
      setPerformance(performanceData.data);
    } catch (error) {
      console.error('Error fetching database data:', error);
      setMessage({ type: 'error', text: 'Failed to load database information' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setOperationLoading('backup');
      const response = await apiService.createDatabaseBackup();
      setMessage({ type: 'success', text: response.message || 'Database backup completed successfully!' });
      
      // Refresh data after successful backup
      await fetchDatabaseData();
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Backup failed:', error);
      setMessage({ type: 'error', text: error.message || 'Backup failed. Please try again.' });
    } finally {
      setOperationLoading(null);
    }
  };

  const handleOptimize = async () => {
    try {
      setOperationLoading('optimize');
      const response = await apiService.optimizeDatabase();
      setMessage({ 
        type: 'success', 
        text: `${response.message} - ${response.data.spaceSaved} saved, ${response.data.performanceImprovement} faster` 
      });
      
      // Refresh data after successful optimization
      await fetchDatabaseData();
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Optimization failed:', error);
      setMessage({ type: 'error', text: error.message || 'Optimization failed. Please try again.' });
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRefresh = async () => {
    setOperationLoading('refresh');
    await fetchDatabaseData();
    setOperationLoading(null);
    setMessage({ type: 'success', text: 'Database information refreshed successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !dbStats) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading database information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
          <p className="text-gray-600 mt-2">Monitor and manage database performance and operations</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Database },
              { id: 'tables', label: 'Tables', icon: HardDrive },
              { id: 'performance', label: 'Performance', icon: BarChart3 },
              { id: 'operations', label: 'Operations', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && dbStats && (
          <div className="space-y-6">
            {/* Database Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Database Status</p>
                      <div className="flex items-center mt-1">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <Badge className={getStatusBadgeColor(dbStats.status)}>
                          {dbStats.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full">
                      <Database className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold">{dbStats.totalRecords.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-full">
                      <HardDrive className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Database Size</p>
                      <p className="text-2xl font-bold">{dbStats.dbSize}</p>
                    </div>
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Server className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Connections</p>
                      <p className="text-2xl font-bold">{dbStats.connections}</p>
                    </div>
                    <div className="bg-orange-100 p-2 rounded-full">
                      <Activity className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Engine:</span>
                      <span className="font-medium">{dbStats.engine}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Version:</span>
                      <span className="font-medium">{dbStats.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Encoding:</span>
                      <span className="font-medium">{dbStats.encoding}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Tables:</span>
                      <span className="font-medium">{dbStats.totalTables}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime:</span>
                      <span className="font-medium">{dbStats.uptime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Backup:</span>
                      <span className="font-medium">{formatDateTime(dbStats.lastBackup)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={handleBackup} 
                      disabled={!!operationLoading}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      {operationLoading === 'backup' ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      ) : (
                        <Download className="h-6 w-6" />
                      )}
                      <span>Backup</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleOptimize} 
                      disabled={!!operationLoading}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      {operationLoading === 'optimize' ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      ) : (
                        <Zap className="h-6 w-6" />
                      )}
                      <span>Optimize</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleRefresh} 
                      disabled={!!operationLoading}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      {operationLoading === 'refresh' ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      ) : (
                        <RefreshCw className="h-6 w-6" />
                      )}
                      <span>Refresh</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Settings className="h-6 w-6" />
                      <span>Configure</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tables' && tables && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Tables</CardTitle>
                <CardDescription>Overview of all database tables and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tables.map((table) => (
                    <div key={table.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Database className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{table.name}</h3>
                          <p className="text-sm text-gray-600">{table.description}</p>
                          <p className="text-sm text-gray-500">
                            {table.records.toLocaleString()} records • {table.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusBadgeColor(table.status)}>
                          {table.status === 'healthy' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Healthy
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Warning
                            </>
                          )}
                        </Badge>
                        <Button variant="outline" size="sm">
                          Analyze
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'performance' && performance && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Query Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Query Time:</span>
                    <span className="font-medium">{performance.queryPerformance.averageQueryTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Slow Queries:</span>
                    <span className="font-medium">{performance.queryPerformance.slowQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Queries:</span>
                    <span className="font-medium">{performance.queryPerformance.totalQueries.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cache Hit Ratio:</span>
                    <span className="font-medium text-green-600">{performance.queryPerformance.cacheHitRatio}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Connection Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Connections:</span>
                    <span className="font-medium">{performance.connections.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Idle Connections:</span>
                    <span className="font-medium">{performance.connections.idle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Connections:</span>
                    <span className="font-medium">{performance.connections.max}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usage:</span>
                    <span className="font-medium">{performance.connections.usage}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Storage Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Used Space:</span>
                    <span className="font-medium">{performance.storage.used}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available Space:</span>
                    <span className="font-medium">{performance.storage.available}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usage:</span>
                    <span className="font-medium">{performance.storage.usage}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Optimization Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Index Efficiency:</span>
                    <span className="font-medium text-blue-600">{performance.indexEfficiency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uptime:</span>
                    <span className="font-medium">{performance.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Optimized:</span>
                    <span className="font-medium">{formatDateTime(performance.lastOptimized)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Operations</CardTitle>
                <CardDescription>Perform maintenance and backup operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Backup & Restore</h4>
                    <div className="space-y-3">
                      <Button 
                        onClick={handleBackup} 
                        disabled={!!operationLoading} 
                        className="w-full h-16 flex items-center justify-center space-x-3"
                      >
                        {operationLoading === 'backup' ? (
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                        <span>Create Database Backup</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        disabled={!!operationLoading}
                        className="w-full h-16 flex items-center justify-center space-x-3"
                      >
                        <Upload className="h-5 w-5" />
                        <span>Restore from Backup</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Maintenance</h4>
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        onClick={handleOptimize} 
                        disabled={!!operationLoading}
                        className="w-full h-16 flex items-center justify-center space-x-3"
                      >
                        {operationLoading === 'optimize' ? (
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        ) : (
                          <Zap className="h-5 w-5" />
                        )}
                        <span>Optimize Database</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        disabled={!!operationLoading}
                        className="w-full h-16 flex items-center justify-center space-x-3"
                      >
                        <Settings className="h-5 w-5" />
                        <span>Database Configuration</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {dbStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">System uptime: {dbStats.uptime}</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Download className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Last backup: {formatDateTime(dbStats.lastBackup)}</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Active connections: {dbStats.connections}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}