// Database helper functions for PostgreSQL/Supabase
import sql from '../db.js';

// User Profile operations
export const userQueries = {
  // Generate random RFID card ID
  generateCardId() {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate phone number
  validatePhone(phone) {
    const phoneRegex = /^[\+]?[0-9\-\(\)\s]{10,}$/;
    return phoneRegex.test(phone);
  },

  // Create a new user with enhanced validation
  async createUser(userData) {
    const { name, email, phone, cardId, balance, dob, address, password } = userData;
    
    // Input validation
    if (!name || !email || !phone || !dob || !address || !password) {
      throw new Error('All fields are required');
    }

    if (!this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!this.validatePhone(phone)) {
      throw new Error('Invalid phone number format');
    }

    try {
      // Check if email already exists
      const existingUser = await sql`
        SELECT email FROM USER_PROFILE WHERE email = ${email}
      `;
      
      if (existingUser.length > 0) {
        throw new Error('Email already exists');
      }

      // Generate unique card ID if not provided
      let finalCardId = cardId;
      if (!finalCardId) {
        let cardExists = true;
        while (cardExists) {
          finalCardId = this.generateCardId();
          const cardCheck = await sql`
            SELECT card_id FROM USER_PROFILE WHERE card_id = ${finalCardId}
          `;
          cardExists = cardCheck.length > 0;
        }
      } else {
        // Check if provided card ID already exists
        const cardCheck = await sql`
          SELECT card_id FROM USER_PROFILE WHERE card_id = ${finalCardId}
        `;
        if (cardCheck.length > 0) {
          throw new Error('Card ID already exists');
        }
      }

      // Set default balance if not provided
      const userBalance = balance !== undefined ? parseFloat(balance) : 100.0;

      const result = await sql`
        INSERT INTO USER_PROFILE (name, email, phone, card_id, balance, dob, address, password)
        VALUES (${name}, ${email}, ${phone}, ${finalCardId}, ${userBalance}, ${dob}, ${address}, ${password})
        RETURNING user_id, name, email, card_id, balance, age, created_at
      `;
      
      return {
        success: true,
        user: result[0],
        cardId: finalCardId
      };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  },

  // Create a new user
  async createUserLegacy(userData) {
    const { name, email, phone, cardId, balance, dob, address, password } = userData;
    try {
      const result = await sql`
        INSERT INTO USER_PROFILE (name, email, phone, card_id, balance, dob, address, password)
        VALUES (${name}, ${email}, ${phone}, ${cardId}, ${balance}, ${dob}, ${address}, ${password})
        RETURNING user_id, name, email, card_id, balance, age
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  },

  // Get all users with pagination
  async getAllUsers(limit = 50, offset = 0) {
    try {
      const result = await sql`
        SELECT user_id, name, email, phone, card_id, balance, age, address, created_at
        FROM USER_PROFILE 
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM USER_PROFILE
      `;
      
      return {
        users: result,
        total: parseInt(countResult[0].total),
        limit,
        offset
      };
    } catch (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }
  },

  // Search users by name or email
  async searchUsers(searchTerm, limit = 20) {
    try {
      const result = await sql`
        SELECT user_id, name, email, phone, card_id, balance, age, address
        FROM USER_PROFILE 
        WHERE name ILIKE ${`%${searchTerm}%`} OR email ILIKE ${`%${searchTerm}%`}
        ORDER BY name
        LIMIT ${limit}
      `;
      return result;
    } catch (error) {
      throw new Error(`Error searching users: ${error.message}`);
    }
  },

  // Update user information
  async updateUser(userId, updateData) {
    const { name, email, phone, address } = updateData;
    
    try {
      // Build dynamic update query
      const updates = [];
      const values = [];
      
      if (name) {
        updates.push('name = $' + (updates.length + 1));
        values.push(name);
      }
      if (email) {
        updates.push('email = $' + (updates.length + 1));
        values.push(email);
      }
      if (phone) {
        updates.push('phone = $' + (updates.length + 1));
        values.push(phone);
      }
      if (address) {
        updates.push('address = $' + (updates.length + 1));
        values.push(address);
      }
      
      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      values.push(userId);
      
      const result = await sql`
        UPDATE USER_PROFILE 
        SET ${sql.unsafe(updates.join(', '))}
        WHERE user_id = ${userId}
        RETURNING user_id, name, email, phone, card_id, balance, age, address
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  },

  // Delete user (soft delete by setting active flag)
  async deleteUser(userId) {
    try {
      const result = await sql`
        UPDATE USER_PROFILE 
        SET active = false
        WHERE user_id = ${userId}
        RETURNING user_id, name, email
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  },

  // Get user by email
  async getUserByEmail(email) {
    try {
      const result = await sql`
        SELECT user_id, name, email, phone, card_id, balance, age, address, created_at
        FROM USER_PROFILE 
        WHERE email = ${email}
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error fetching user by email: ${error.message}`);
    }
  },

  // Get user by card ID
  async getUserByCardId(cardId) {
    try {
      const result = await sql`
        SELECT user_id, name, email, phone, card_id, balance, age, address
        FROM USER_PROFILE 
        WHERE card_id = ${cardId}
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error fetching user by card ID: ${error.message}`);
    }
  },

  // Update user balance
  async updateBalance(userId, newBalance) {
    try {
      const result = await sql`
        UPDATE USER_PROFILE 
        SET balance = ${newBalance}
        WHERE user_id = ${userId}
        RETURNING balance
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error updating balance: ${error.message}`);
    }
  },

  // Get user with password (for authentication)
  async getUserWithPassword(email) {
    try {
      const result = await sql`
        SELECT user_id, name, email, password, card_id, balance
        FROM USER_PROFILE 
        WHERE email = ${email}
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error fetching user with password: ${error.message}`);
    }
  }
};

// Travel operations
export const travelQueries = {
  // Create current travel
  async createCurrentTravel(travelData) {
    const { 
      userId, pickPoint, dropPoint, perKmCost, totalCost, 
      currentLongitude, currentLatitude, dropoffLongitude, dropoffLatitude 
    } = travelData;
    
    try {
      const result = await sql`
        INSERT INTO CURRENT_TRAVEL 
        (user_id, pick_point, drop_point, per_km_cost, total_cost, 
         current_longitude, current_latitude, dropoff_longitude, dropoff_latitude)
        VALUES (${userId}, ${pickPoint}, ${dropPoint}, ${perKmCost}, ${totalCost},
                ${currentLongitude}, ${currentLatitude}, ${dropoffLongitude}, ${dropoffLatitude})
        RETURNING travel_id, user_id, pick_point, travel_status, created_at
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error creating travel: ${error.message}`);
    }
  },

  // Get current travels for user
  async getCurrentTravels(userId) {
    try {
      const result = await sql`
        SELECT * FROM CURRENT_TRAVEL 
        WHERE user_id = ${userId} AND travel_status = 'ONGOING'
        ORDER BY created_at DESC
      `;
      return result;
    } catch (error) {
      throw new Error(`Error fetching current travels: ${error.message}`);
    }
  },

  // Complete travel
  async completeTravel(travelId, totalCost) {
    try {
      const result = await sql`
        UPDATE CURRENT_TRAVEL 
        SET travel_status = 'COMPLETED', total_cost = ${totalCost}
        WHERE travel_id = ${travelId}
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error completing travel: ${error.message}`);
    }
  },

  // Add to travel history
  async addToHistory(travelData) {
    const { userId, pickPoint, dropPoint, totalCost, remainingBalance } = travelData;
    try {
      const result = await sql`
        INSERT INTO TRAVEL_HISTORY (user_id, pick_point, drop_point, total_cost, remaining_balance)
        VALUES (${userId}, ${pickPoint}, ${dropPoint}, ${totalCost}, ${remainingBalance})
        RETURNING history_id, travel_time
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error adding to travel history: ${error.message}`);
    }
  },

  // Get travel history for user
  async getTravelHistory(userId, limit = 10) {
    try {
      const result = await sql`
        SELECT * FROM TRAVEL_HISTORY 
        WHERE user_id = ${userId}
        ORDER BY travel_time DESC
        LIMIT ${limit}
      `;
      return result;
    } catch (error) {
      throw new Error(`Error fetching travel history: ${error.message}`);
    }
  }
};

// Recharge operations
export const rechargeQueries = {
  // Add recharge record
  async addRecharge(rechargeData) {
    const { userId, amount, paymentMethod } = rechargeData;
    try {
      const result = await sql`
        INSERT INTO RECHARGE_HISTORY (user_id, recharge_amount, payment_method)
        VALUES (${userId}, ${amount}, ${paymentMethod})
        RETURNING recharge_id, recharge_date
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error adding recharge: ${error.message}`);
    }
  },

  // Get recharge history
  async getRechargeHistory(userId, limit = 10) {
    try {
      const result = await sql`
        SELECT * FROM RECHARGE_HISTORY 
        WHERE user_id = ${userId}
        ORDER BY recharge_date DESC
        LIMIT ${limit}
      `;
      return result;
    } catch (error) {
      throw new Error(`Error fetching recharge history: ${error.message}`);
    }
  }
};

// Bus operations
export const busQueries = {
  // Get all buses
  async getAllBuses() {
    try {
      const result = await sql`
        SELECT * FROM BUS_INFO
        ORDER BY bus_id
      `;
      return result;
    } catch (error) {
      throw new Error(`Error fetching buses: ${error.message}`);
    }
  },

  // Update bus seats
  async updateBusSeats(busId, availableSeats) {
    try {
      const result = await sql`
        UPDATE BUS_INFO 
        SET available_seats = ${availableSeats}
        WHERE bus_id = ${busId}
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      throw new Error(`Error updating bus seats: ${error.message}`);
    }
  }
};

export default { userQueries, travelQueries, rechargeQueries, busQueries };
