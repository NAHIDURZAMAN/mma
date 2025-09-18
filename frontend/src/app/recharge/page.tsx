'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  CreditCard, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  History,
  Shield,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import RechargeCard from '@/components/RechargeCard';

export default function RechargePage() {
  const { user, refreshUser } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentTransactions();
  }, [user]);

  const loadRecentTransactions = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }
    
    try {
      // Load recent recharge history
      const response = await fetch(`http://localhost:2000/api/recharge-history?user_id=${user.user_id}&limit=5`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setRecentTransactions(data.data);
      }
    } catch (error) {
      console.error('Failed to load recharge history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceUpdate = async () => {
    await refreshUser(); // Refresh user data to get updated balance
    loadRecentTransactions(); // Refresh transaction history
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading recharge page...</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Recharge Account</h1>
            <p className="text-muted-foreground">
              Add money to your Smart Transit account using secure Stripe payment
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/recharge-history'}
            className="flex items-center space-x-2"
          >
            <History className="h-4 w-4" />
            <span>View History</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Balance & Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wallet className="h-5 w-5" />
                <span>Account Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  ৳{user?.balance || 0}
                </div>
                <p className="text-sm text-muted-foreground mb-4">Current Balance</p>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account ID:</span>
                  <span className="font-mono">{user?.user_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card ID:</span>
                  <span className="font-mono">{user?.card_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={user?.balance && user.balance > 10 ? 'default' : 'destructive'}>
                    {user?.balance && user.balance > 10 ? 'Active' : 'Low Balance'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Payment Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Stripe Secured</p>
                  <p className="text-xs text-muted-foreground">PCI DSS Level 1 compliant</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">SSL Encrypted</p>
                  <p className="text-xs text-muted-foreground">256-bit encryption</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Zap className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Instant Credit</p>
                  <p className="text-xs text-muted-foreground">Balance updated immediately</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stripe Payment Form */}
        <div className="lg:col-span-2">
          <RechargeCard user={user} onBalanceUpdate={handleBalanceUpdate} />
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Recent Recharges</span>
            </CardTitle>
            <CardDescription>Your recent top-up transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.map((transaction: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">৳{transaction.amount || transaction.recharge_amount}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.recharge_date || transaction.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Completed
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}