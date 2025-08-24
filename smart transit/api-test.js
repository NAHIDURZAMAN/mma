// API Test Script for Terminal
import https from 'https'
import http from 'http'

const baseUrl = 'http://localhost:2000'

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    }

    if (data) {
      const jsonData = JSON.stringify(data)
      options.headers['Content-Length'] = Buffer.byteLength(jsonData)
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body)
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            data: jsonBody
          })
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            data: body
          })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

// Test functions
async function testEndpoint(name, url, method = 'GET', data = null) {
  console.log(`\n🧪 Testing: ${name}`)
  console.log(`📍 ${method} ${url}`)
  
  try {
    const response = await makeRequest(url, method, data)
    console.log(`✅ Status: ${response.status} ${response.statusMessage}`)
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2))
    return response
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return null
  }
}

async function runTests() {
  console.log('🚀 Smart Transit API Tests')
  console.log('=' * 50)

  // Test 1: Health Check
  await testEndpoint('Health Check', `${baseUrl}/api/health`)

  // Test 2: Get All Users
  await testEndpoint('Get All Users', `${baseUrl}/api/users`)

  // Test 3: Get User by ID
  await testEndpoint('Get User by ID', `${baseUrl}/api/users/U000001`)

  // Test 4: Get All Buses
  await testEndpoint('Get All Buses', `${baseUrl}/api/buses`)

  // Test 5: Get User Travel History
  await testEndpoint('Get User Travel History', `${baseUrl}/api/users/U000001/travels`)

  // Test 6: Get User Recharge History
  await testEndpoint('Get User Recharge History', `${baseUrl}/api/users/U000001/recharges`)

  // Test 7: Create New User (POST)
  const newUser = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    card_id: 'TESTCARD123',
    balance: 100,
    dob: '1995-01-01',
    address: 'Test Address'
  }
  await testEndpoint('Create New User', `${baseUrl}/api/users`, 'POST', newUser)

  // Test 8: Update User Balance (PATCH)
  const balanceUpdate = { balance: 150 }
  await testEndpoint('Update User Balance', `${baseUrl}/api/users/U000001/balance`, 'PATCH', balanceUpdate)

  // Test 9: Create Recharge (POST)
  const rechargeData = {
    user_id: 'U000001',
    amount: 50,
    payment_method: 'BKASH'
  }
  await testEndpoint('Create Recharge', `${baseUrl}/api/recharge`, 'POST', rechargeData)

  // Test 10: Start Travel (POST)
  const travelData = {
    user_id: 'U000001',
    pick_point: 'Dhanmondi 32',
    current_longitude: '90.3753',
    current_latitude: '23.7465'
  }
  await testEndpoint('Start Travel', `${baseUrl}/api/travel/start`, 'POST', travelData)

  // Test 11: Invalid Endpoint (404 test)
  await testEndpoint('Invalid Endpoint (404)', `${baseUrl}/api/invalid`)

  console.log('\n🏁 All tests completed!')
}

// Wait a moment for server to be ready, then run tests
setTimeout(() => {
  runTests().catch(console.error)
}, 1000)
