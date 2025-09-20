'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiService, SystemSettings, SystemHealth } from '@/lib/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    siteName: '',
    siteUrl: '',
    adminEmail: '',
    enableNotifications: true,
    enableRegistration: true,
    maxBalance: 5000,
    minRecharge: 10,
    farePerKm: 2.5,
    baseFare: 15,
    systemMaintenance: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (settings) {
      setFormData({
        siteName: settings.siteName,
        siteUrl: settings.siteUrl,
        adminEmail: settings.adminEmail,
        enableNotifications: settings.enableNotifications,
        enableRegistration: settings.enableRegistration,
        maxBalance: settings.maxBalance,
        minRecharge: settings.minRecharge,
        farePerKm: settings.farePerKm,
        baseFare: settings.baseFare,
        systemMaintenance: settings.systemMaintenance
      });
    }
  }, [settings]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsData, healthData] = await Promise.all([
        apiService.getSystemSettings(),
        apiService.getSystemHealth()
      ]);
      
      setSettings(settingsData.data);
      setSystemHealth(healthData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load settings data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await apiService.updateSystemSettings(formData);
      setSettings(response.data);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.resetSystemSettings();
      setSettings(response.data);
      setMessage({ type: 'success', text: 'Settings reset to defaults successfully!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error resetting settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational':
      case 'connected':
      case 'online':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'offline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">Configure system settings and monitor health</p>
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
              { id: 'general', label: 'General Settings' },
              { id: 'security', label: 'Security & Access' },
              { id: 'payment', label: 'Payment Settings' },
              { id: 'system', label: 'System Health' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Site Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Name
                  </label>
                  <Input
                    value={formData.siteName}
                    onChange={(e) => handleInputChange('siteName', e.target.value)}
                    placeholder="Smart Transit System"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site URL
                  </label>
                  <Input
                    value={formData.siteUrl}
                    onChange={(e) => handleInputChange('siteUrl', e.target.value)}
                    placeholder="https://smarttransit.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Email
                  </label>
                  <Input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                    placeholder="admin@smarttransit.com"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable Notifications
                    </label>
                    <p className="text-xs text-gray-500">Send email notifications to users</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableNotifications}
                    onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Allow Registration
                    </label>
                    <p className="text-xs text-gray-500">Allow new users to register</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableRegistration}
                    onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Maintenance Mode
                    </label>
                    <p className="text-xs text-gray-500">Disable system for maintenance</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.systemMaintenance}
                    onChange={(e) => handleInputChange('systemMaintenance', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Access Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      User Registration
                    </label>
                    <p className="text-xs text-gray-500">Control new user registrations</p>
                  </div>
                  <Badge className={formData.enableRegistration ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {formData.enableRegistration ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Email Notifications
                    </label>
                    <p className="text-xs text-gray-500">System email notifications</p>
                  </div>
                  <Badge className={formData.enableNotifications ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {formData.enableNotifications ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Maintenance Mode
                    </label>
                    <p className="text-xs text-gray-500">System maintenance status</p>
                  </div>
                  <Badge className={formData.systemMaintenance ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                    {formData.systemMaintenance ? 'Active' : 'Normal'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Administrative Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Admin Email
                  </label>
                  <div className="text-sm text-gray-600">{formData.adminEmail}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System URL
                  </label>
                  <div className="text-sm text-gray-600">{formData.siteUrl}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Updated
                  </label>
                  <div className="text-sm text-gray-600">
                    {settings?.lastUpdated ? formatDateTime(settings.lastUpdated) : 'Never'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fare Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Fare (BDT)
                  </label>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={formData.baseFare}
                    onChange={(e) => handleInputChange('baseFare', parseFloat(e.target.value) || 0)}
                    placeholder="15.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum fare for any journey</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fare per Kilometer (BDT)
                  </label>
                  <Input
                    type="number"
                    step="0.10"
                    min="0"
                    value={formData.farePerKm}
                    onChange={(e) => handleInputChange('farePerKm', parseFloat(e.target.value) || 0)}
                    placeholder="2.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Additional charge per kilometer</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balance Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Balance (BDT)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxBalance}
                    onChange={(e) => handleInputChange('maxBalance', parseFloat(e.target.value) || 0)}
                    placeholder="5000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum account balance allowed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Recharge (BDT)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minRecharge}
                    onChange={(e) => handleInputChange('minRecharge', parseFloat(e.target.value) || 0)}
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum recharge amount</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'system' && systemHealth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Overall Status</span>
                  <Badge className={getStatusBadgeColor(systemHealth.status)}>
                    {systemHealth.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Database</span>
                  <Badge className={getStatusBadgeColor(systemHealth.database.status)}>
                    {systemHealth.database.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">API Service</span>
                  <Badge className={getStatusBadgeColor(systemHealth.api.status)}>
                    {systemHealth.api.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">WebSocket</span>
                  <Badge className={getStatusBadgeColor(systemHealth.websocket.status)}>
                    {systemHealth.websocket.status.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database Type
                  </label>
                  <div className="text-sm text-gray-600">{systemHealth.database.type}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Users
                  </label>
                  <div className="text-sm text-gray-600">{systemHealth.database.userCount.toLocaleString()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Version
                  </label>
                  <div className="text-sm text-gray-600">{systemHealth.api.version}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Environment
                  </label>
                  <div className="text-sm text-gray-600">{systemHealth.api.environment}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connected Clients
                  </label>
                  <div className="text-sm text-gray-600">{systemHealth.websocket.connectedClients}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Check
                  </label>
                  <div className="text-sm text-gray-600">{formatDateTime(systemHealth.timestamp)}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        {activeTab !== 'system' && (
          <div className="mt-8 flex justify-between">
            <Button
              onClick={handleResetSettings}
              variant="outline"
              disabled={saving}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              Reset to Defaults
            </Button>
            
            <div className="space-x-4">
              <Button
                onClick={fetchData}
                variant="outline"
                disabled={saving}
              >
                Refresh
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
