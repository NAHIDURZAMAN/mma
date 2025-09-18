// Simple Stripe Test Script
import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config()

console.log('Testing Stripe Configuration...')
console.log('Environment variables loaded:')
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? `${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...${process.env.STRIPE_SECRET_KEY.slice(-4)}` : 'NOT FOUND')

const testKey = 'sk_test_51QRdLvCEziLhJKuPelArmqWIVeGkGL2RIRslWLg9s33pko5kOcuiSWd8ZdmbFiFhZji70lHLCCfBkPFSdBl2sBjZ00KKQsmE41z'
console.log('Test key:', `${testKey.substring(0, 12)}...${testKey.slice(-4)}`)

try {
  // Test with environment variable
  const stripeEnv = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  })
  
  console.log('Testing with environment variable...')
  const testIntentEnv = await stripeEnv.paymentIntents.create({
    amount: 10000,
    currency: 'bdt',
    metadata: { test: 'env_test' }
  })
  
  console.log('✅ Environment variable test SUCCESS:', testIntentEnv.id)
  
} catch (error) {
  console.log('❌ Environment variable test FAILED:', error.message)
  
  try {
    // Test with direct key
    const stripeDirect = new Stripe(testKey, {
      apiVersion: '2023-10-16',
    })
    
    console.log('Testing with direct key...')
    const testIntentDirect = await stripeDirect.paymentIntents.create({
      amount: 10000,
      currency: 'bdt',
      metadata: { test: 'direct_test' }
    })
    
    console.log('✅ Direct key test SUCCESS:', testIntentDirect.id)
    
  } catch (directError) {
    console.log('❌ Direct key test FAILED:', directError.message)
    console.log('Full error:', directError)
  }
}