// Recharge History API Routes using Supabase REST API
// Note: Using existing supabaseRequest function instead of direct DB connection

// Helper function to validate user ID format
function validateUserId(userId) {
  if (!userId) {
    return { valid: false, message: 'User ID is required' }
  }
  
  // Check if it's a valid user ID format (e.g., U000001)
  if (typeof userId !== 'string' || userId.length < 1) {
    return { valid: false, message: 'Invalid user ID format' }
  }
  
  return { valid: true }
}

// Get recharge history for a specific user using Supabase REST API
export async function getRechargeHistory(req, res) {
  try {
    const { userId } = req.params
    const { limit = 50, payment_method } = req.query
    
    console.log(`📊 Fetching recharge history for user: ${userId}`)
    
    // Validate user ID
    const validation = validateUserId(userId)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      })
    }

    // Import the supabaseRequest function from the main server
    const { supabaseRequest } = await import('../openweb-websocket.js')
    
    // Build query string for Supabase REST API
    let query = `recharge_history?user_id=eq.${userId}&select=*`
    
    // Add payment method filter if provided
    if (payment_method && payment_method !== 'all') {
      query += `&payment_method=eq.${payment_method}`
    }
    
    // Add ordering and limit
    query += `&order=recharge_date.desc&limit=${limit}`
    
    console.log(`🔍 Supabase query: ${query}`)
    
    // Make the API call using existing supabaseRequest function
    const history = await supabaseRequest(query)
    
    console.log(`✅ Found ${history.length} recharge records for user ${userId}`)
    
    // Add status field if missing (for older records)
    const enrichedHistory = (history || []).map(record => ({
      ...record,
      status: record.status || 'completed'
    }))
    
    res.json({
      success: true,
      history: enrichedHistory,
      count: enrichedHistory.length,
      user_id: userId,
      filters_applied: {
        payment_method: payment_method || 'all',
        limit: parseInt(limit)
      }
    })

  } catch (error) {
    console.error('❌ Error fetching recharge history:', error)
    
    // Fallback: Return empty array with error message
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recharge history. Please check database connection.',
      error: error.message,
      history: [],
      count: 0
    })
  }
}

// Add a new recharge record
export async function addRechargeRecord(req, res) {
  try {
    const { user_id, amount, payment_method, transaction_id } = req.body
    
    console.log(`💰 Adding recharge record: ${user_id}, ৳${amount}, ${payment_method}`)
    
    // Validate required fields
    if (!user_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'user_id, amount, and payment_method are required'
      })
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      })
    }

    // Insert recharge record
    const rechargeResult = await sql`
      INSERT INTO recharge_history (user_id, recharge_amount, payment_method)
      VALUES (${user_id}, ${parseFloat(amount)}, ${payment_method})
      RETURNING recharge_id, recharge_date, recharge_amount
    `
    
    if (!rechargeResult || rechargeResult.length === 0) {
      throw new Error('Failed to insert recharge record')
    }

    const newRecord = rechargeResult[0]
    console.log(`✅ Recharge record created: ${newRecord.recharge_id}`)

    // Update user balance
    try {
      const userResult = await sql`
        SELECT balance FROM user_profile WHERE user_id = ${user_id}
      `
      
      if (!userResult || userResult.length === 0) {
        throw new Error('User not found')
      }

      const currentBalance = userResult[0].balance || 0
      const newBalance = currentBalance + parseFloat(amount)

      await sql`
        UPDATE user_profile 
        SET balance = ${newBalance}
        WHERE user_id = ${user_id}
      `

      console.log(`✅ User balance updated: ৳${currentBalance} → ৳${newBalance}`)

      res.json({
        success: true,
        message: 'Recharge successful',
        data: {
          recharge_id: newRecord.recharge_id,
          recharge_date: newRecord.recharge_date,
          amount: newRecord.recharge_amount,
          payment_method: payment_method,
          transaction_id: transaction_id || null,
          previous_balance: currentBalance,
          new_balance: newBalance
        }
      })

    } catch (balanceError) {
      console.error('❌ Error updating user balance:', balanceError)
      res.status(500).json({
        success: false,
        message: 'Recharge record created but failed to update balance',
        error: balanceError.message
      })
    }

  } catch (error) {
    console.error('❌ Error adding recharge record:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add recharge record',
      error: error.message
    })
  }
}

// Get recharge statistics for a user
export async function getRechargeStats(req, res) {
  try {
    const { userId } = req.params
    
    console.log(`📈 Fetching recharge statistics for user: ${userId}`)
    
    // Validate user ID
    const validation = validateUserId(userId)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      })
    }

    // Get total recharges and amount
    const totalStats = await sql`
      SELECT 
        COUNT(*) as total_recharges,
        COALESCE(SUM(recharge_amount), 0) as total_amount
      FROM recharge_history 
      WHERE user_id = ${userId}
    `

    // Get stats by payment method
    const paymentMethodStats = await sql`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(recharge_amount) as amount
      FROM recharge_history 
      WHERE user_id = ${userId}
      GROUP BY payment_method
      ORDER BY amount DESC
    `

    // Get monthly stats for current year
    const monthlyStats = await sql`
      SELECT 
        EXTRACT(MONTH FROM recharge_date) as month,
        COUNT(*) as count,
        SUM(recharge_amount) as amount
      FROM recharge_history 
      WHERE user_id = ${userId}
      AND EXTRACT(YEAR FROM recharge_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY EXTRACT(MONTH FROM recharge_date)
      ORDER BY month
    `

    // Get user's current balance
    const userBalance = await sql`
      SELECT balance, name FROM user_profile WHERE user_id = ${userId}
    `

    const stats = {
      user_id: userId,
      user_name: userBalance[0]?.name || 'Unknown',
      current_balance: userBalance[0]?.balance || 0,
      total_recharges: parseInt(totalStats[0]?.total_recharges || 0),
      total_amount_recharged: parseFloat(totalStats[0]?.total_amount || 0),
      payment_methods: paymentMethodStats || [],
      monthly_breakdown: monthlyStats || [],
      average_recharge: totalStats[0]?.total_recharges > 0 
        ? parseFloat(totalStats[0].total_amount) / parseInt(totalStats[0].total_recharges)
        : 0
    }

    console.log(`✅ Statistics generated for user ${userId}: ${stats.total_recharges} recharges, ৳${stats.total_amount_recharged} total`)

    res.json({
      success: true,
      stats: stats
    })

  } catch (error) {
    console.error('❌ Error fetching recharge statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recharge statistics',
      error: error.message
    })
  }
}

// Get all recharge history (admin endpoint)
export async function getAllRechargeHistory(req, res) {
  try {
    const { limit = 100, payment_method, date_from, date_to } = req.query
    
    console.log('📊 Fetching all recharge history (admin)')
    
    let whereConditions = []
    let params = []
    
    if (payment_method && payment_method !== 'all') {
      whereConditions.push('payment_method = $' + (params.length + 1))
      params.push(payment_method)
    }
    
    if (date_from) {
      whereConditions.push('recharge_date >= $' + (params.length + 1))
      params.push(date_from)
    }
    
    if (date_to) {
      whereConditions.push('recharge_date <= $' + (params.length + 1))
      params.push(date_to)
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''
    
    const query = `
      SELECT 
        rh.recharge_id,
        rh.user_id,
        rh.recharge_date,
        rh.recharge_amount,
        rh.payment_method,
        rh.created_at,
        up.name as user_name,
        up.email as user_email,
        up.card_id as user_card_id
      FROM recharge_history rh
      LEFT JOIN user_profile up ON rh.user_id = up.user_id
      ${whereClause}
      ORDER BY rh.recharge_date DESC
      LIMIT $${params.length + 1}
    `
    
    params.push(parseInt(limit))
    
    const history = await sql.unsafe(query, params)
    
    // Calculate summary statistics
    const totalAmount = history.reduce((sum, record) => sum + (record.recharge_amount || 0), 0)
    const uniqueUsers = [...new Set(history.map(record => record.user_id))].length
    
    console.log(`✅ Retrieved ${history.length} recharge records from ${uniqueUsers} users, total: ৳${totalAmount}`)

    res.json({
      success: true,
      history: history || [],
      count: history ? history.length : 0,
      summary: {
        total_records: history ? history.length : 0,
        total_amount: totalAmount,
        unique_users: uniqueUsers
      },
      filters_applied: {
        payment_method: payment_method || 'all',
        date_range: date_from && date_to ? { from: date_from, to: date_to } : null,
        limit: parseInt(limit)
      }
    })

  } catch (error) {
    console.error('❌ Error fetching all recharge history:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recharge history',
      error: error.message,
      history: [],
      count: 0
    })
  }
}

// Test database connection for recharge history
export async function testRechargeConnection(req, res) {
  try {
    console.log('🧪 Testing recharge history database connection...')
    
    // Test 1: Check if recharge_history table exists and is accessible
    const tableTest = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'recharge_history'
      ORDER BY ordinal_position
    `
    
    console.log('📋 Recharge history table structure:', tableTest)
    
    // Test 2: Check if we can read from the table
    const countTest = await sql`
      SELECT COUNT(*) as total_records FROM recharge_history
    `
    
    console.log('📊 Total recharge records:', countTest[0]?.total_records)
    
    // Test 3: Check recent records
    const recentTest = await sql`
      SELECT user_id, recharge_amount, payment_method, recharge_date
      FROM recharge_history 
      ORDER BY recharge_date DESC 
      LIMIT 5
    `
    
    console.log('📝 Recent recharge records:', recentTest.length)

    res.json({
      success: true,
      message: 'Database connection test successful',
      test_results: {
        table_exists: tableTest.length > 0,
        table_columns: tableTest,
        total_records: parseInt(countTest[0]?.total_records || 0),
        recent_records: recentTest,
        connection_status: 'OK'
      }
    })

  } catch (error) {
    console.error('❌ Database connection test failed:', error)
    res.status(500).json({
      success: false,
      message: 'Database connection test failed',
      error: error.message,
      connection_status: 'ERROR'
    })
  }
}

export default {
  getRechargeHistory,
  addRechargeRecord,
  getRechargeStats,
  getAllRechargeHistory,
  testRechargeConnection
}