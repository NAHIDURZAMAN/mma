'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Plus, DollarSign, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

// Load Stripe with publishable key - Hardcoded for development
// Note: This is a TEST key. For production, use live key (pk_live_...)
// Updated to match backend secret key pair
const stripePromise = loadStripe('pk_test_51QEK5eJqwXDBmKmPjHZJt7CKlKy2ygz4A1QlGH8Q3VbNcBgVfqWL6K9pF7t2E1K4T9xBfKd2J7l3H6rS5dW8c9x200sE9qJ4y2')

interface RechargeFormProps {
  user: any
  onRechargeSuccess: (amount: number) => void
}

// Quick recharge amounts
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000]

function RechargeForm({ user, onRechargeSuccess }: RechargeFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { refreshUser } = useAuth()
  const [amount, setAmount] = useState<number>(500)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const handleAmountSelect = (selectedAmount: number) => {
    setAmount(selectedAmount)
    setCustomAmount('')
  }

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomAmount(value)
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue > 0) {
      setAmount(numValue)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stripe || !elements) {
      return
    }

    if (amount < 50) {
      setErrorMessage('Minimum recharge amount is ৳50')
      return
    }

    setIsProcessing(true)
    setPaymentStatus('idle')
    setErrorMessage('')

    try {
      // Create payment intent on backend
      const response = await fetch('http://localhost:2000/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: amount * 100, // Convert to paisa (smallest currency unit)
          currency: 'bdt',
          userId: user.user_id
        }),
      })

      const { clientSecret, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Confirm payment
      const cardElement = elements.getElement(CardElement)
      
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user.name,
            email: user.email,
          },
        },
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (paymentIntent?.status === 'succeeded') {
        // Update user balance on backend
        const updateResponse = await fetch('http://localhost:2000/api/update-balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.user_id,
            amount: amount,
            transactionId: paymentIntent.id
          }),
        })

        const updateResult = await updateResponse.json()

        if (updateResult.success) {
          // Refresh user data to get updated balance
          await refreshUser()
          setPaymentStatus('success')
          onRechargeSuccess(amount)
        } else {
          throw new Error(updateResult.message || 'Failed to update balance')
        }
      }
    } catch (error: any) {
      console.error('Payment failed:', error)
      setErrorMessage(error.message || 'Payment failed. Please try again.')
      setPaymentStatus('error')
    } finally {
      setIsProcessing(false)
    }
  }

  if (paymentStatus === 'success') {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-700 mb-2">
          Payment Successful!
        </h3>
        <p className="text-gray-600 mb-4">
          ৳{amount} has been added to your account
        </p>
        <Button 
          onClick={() => {
            setPaymentStatus('idle')
            setAmount(500)
            setCustomAmount('')
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          Recharge Again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Recharge Amount
        </label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {QUICK_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => handleAmountSelect(quickAmount)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                amount === quickAmount && !customAmount
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">৳{quickAmount}</div>
            </button>
          ))}
        </div>
        
        {/* Custom Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter custom amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              ৳
            </span>
            <input
              type="number"
              min="50"
              max="50000"
              value={customAmount}
              onChange={handleCustomAmountChange}
              placeholder="Enter amount (min ৳50)"
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Total Amount:</span>
          <span className="text-blue-600">৳{amount}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Amount will be added to your Smart Transit account
        </p>
      </div>

      {/* Card Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Details
        </label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Test card: 4242 4242 4242 4242, any future date, any 3-digit CVC
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || isProcessing || amount < 50}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ৳{amount}
          </>
        )}
      </Button>
    </form>
  )
}

interface RechargeCardProps {
  user: any
  onBalanceUpdate?: () => void
}

export default function RechargeCard({ user, onBalanceUpdate }: RechargeCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  const handleRechargeSuccess = (amount: number) => {
    if (onBalanceUpdate) {
      onBalanceUpdate()
    }
    // Close the form after 3 seconds
    setTimeout(() => {
      setIsOpen(false)
    }, 3000)
  }

  // Redirect to login if user is not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Account Recharge
          </CardTitle>
          <CardDescription>
            Please login to recharge your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">You need to be logged in to recharge your account.</p>
            <Button onClick={() => router.push('/login')} className="bg-blue-600 hover:bg-blue-700">
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Account Recharge
        </CardTitle>
        <CardDescription>
          Add money to your Smart Transit account using Stripe
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isOpen ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Current Balance:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-lg px-3 py-1">
                ৳{user.balance || 0}
              </Badge>
            </div>
            
            <Button
              onClick={() => setIsOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Recharge Account
            </Button>
            
            <div className="text-xs text-gray-500 text-center">
              <p>💳 Secure payment powered by Stripe</p>
              <p>🔒 Your payment information is encrypted and secure</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Recharge Your Account</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
            
            <Elements stripe={stripePromise}>
              <RechargeForm user={user} onRechargeSuccess={handleRechargeSuccess} />
            </Elements>
          </div>
        )}
      </CardContent>
    </Card>
  )
}