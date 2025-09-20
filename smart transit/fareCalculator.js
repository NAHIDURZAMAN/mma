/**
 * Distance-based Fare Calculator for Smart Transit System
 * Calculates fare based on distance traveled between stations
 * Now includes User Management functionality
 */

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fare rates per kilometer for different vehicle types
const FARE_RATES = {
    bus: {
        baseFare: 10,      // Base fare in BDT
        perKmRate: 2.5,    // Rate per kilometer
        maxFare: 50,       // Maximum fare cap
        minFare: 10        // Minimum fare
    },
    express: {
        baseFare: 15,
        perKmRate: 3.5,
        maxFare: 80,
        minFare: 15
    },
    metro: {
        baseFare: 20,
        perKmRate: 4.0,
        maxFare: 100,
        minFare: 20
    },
    tram: {
        baseFare: 12,
        perKmRate: 3.0,
        maxFare: 60,
        minFare: 12
    }
};

// Distance bands with fixed fares (alternative pricing model)
const DISTANCE_BANDS = [
    { minKm: 0, maxKm: 2, fare: { bus: 10, express: 15, metro: 20, tram: 12 } },
    { minKm: 2, maxKm: 5, fare: { bus: 20, express: 25, metro: 35, tram: 22 } },
    { minKm: 5, maxKm: 10, fare: { bus: 30, express: 40, metro: 50, tram: 35 } },
    { minKm: 10, maxKm: 20, fare: { bus: 45, express: 60, metro: 75, tram: 50 } },
    { minKm: 20, maxKm: Infinity, fare: { bus: 50, express: 80, metro: 100, tram: 60 } }
];

/**
 * Generate random RFID card ID
 * @returns {string} 10-character hexadecimal card ID
 */
function generateCardId() {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
function validatePhone(phone) {
    const phoneRegex = /^[\+]?[0-9\-\(\)\s]{10,}$/;
    return phoneRegex.test(phone);
}

/**
 * Validate card number (RFID card format)
 * @param {string} cardNumber - Card number to validate
 * @returns {boolean} True if valid card number
 */
function validateCardNumber(cardNumber) {
    // Card number should be 8-16 characters, alphanumeric
    const cardRegex = /^[A-Za-z0-9]{8,16}$/;
    return cardRegex.test(cardNumber);
}

/**
 * Create a new user in the database
 * @param {object} userData - User data object
 * @returns {object} Created user data or error
 */
async function createUser(userData) {
    const { name, email, phone, dob, address, password, balance, cardNumber, cardType = 'regular' } = userData;
    
    // Input validation
    if (!name || !email || !phone || !dob || !address || !password || !cardNumber) {
        throw new Error('All fields including card number are required');
    }

    if (!validateEmail(email)) {
        throw new Error('Invalid email format');
    }

    if (!validatePhone(phone)) {
        throw new Error('Invalid phone number format');
    }

    if (!validateCardNumber(cardNumber)) {
        throw new Error('Invalid card number format. Must be 10-16 digits');
    }

    // Validate card type
    const validCardTypes = ['regular', 'student', 'senior'];
    if (!validCardTypes.includes(cardType)) {
        throw new Error('Invalid card type. Must be regular, student, or senior');
    }

    try {
        // Check if email already exists
        const { data: existingEmailUsers } = await supabase
            .from('user_profile')
            .select('email')
            .eq('email', email);

        if (existingEmailUsers && existingEmailUsers.length > 0) {
            throw new Error('Email already exists');
        }

        // Check if card number already exists
        const { data: existingCardUsers } = await supabase
            .from('user_profile')
            .select('card_id')
            .eq('card_id', cardNumber);

        if (existingCardUsers && existingCardUsers.length > 0) {
            throw new Error('Card number already exists');
        }

        // Convert DOB to proper date format
        const dobDate = new Date(dob).toISOString();
        
        // Set default balance if not provided
        const userBalance = balance ? parseFloat(balance) : 100.0;

        // First, get the maximum user_id to generate next available ID
        const { data: maxUserData, error: maxError } = await supabase
            .from('user_profile')
            .select('user_id')
            .order('user_id', { ascending: false })
            .limit(1);

        if (maxError) {
            throw new Error(`Database error: ${maxError.message}`);
        }

        const nextUserId = maxUserData && maxUserData.length > 0 ? maxUserData[0].user_id + 1 : 1;

        // Insert new user with calculated user_id
        const { data: newUsers, error: insertError } = await supabase
            .from('user_profile')
            .insert([{
                user_id: nextUserId,
                name,
                email,
                phone,
                card_id: cardNumber,
                balance: userBalance,
                dob: dobDate,
                address,
                password, // In production, hash the password
                card_type: cardType
            }])
            .select('user_id, name, email, phone, card_id, balance, address, card_type');

        if (insertError) {
            // Handle specific database errors
            if (insertError.code === '23505') {
                if (insertError.message.includes('email')) {
                    throw new Error('Email already exists');
                }
                if (insertError.message.includes('card_id')) {
                    throw new Error('Card number already exists');
                }
            }
            throw new Error(`Database error: ${insertError.message}`);
        }

        return {
            success: true,
            message: 'User created successfully',
            user: newUsers[0],
            cardId: cardNumber
        };

    } catch (err) {
        throw new Error(`Error creating user: ${err.message}`);
    }
}

/**
 * Get user by card ID
 * @param {string} cardId - RFID card ID
 * @returns {object} User data or null if not found
 */
async function getUserByCardId(cardId) {
    try {
        const { data: users, error } = await supabase
            .from('user_profile')
            .select('user_id, name, email, phone, card_id, balance, address, card_type')
            .eq('card_id', cardId);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return users && users.length > 0 ? users[0] : null;

    } catch (err) {
        throw new Error(`Error fetching user by card ID: ${err.message}`);
    }
}

/**
 * Get all users from database
 * @param {number} limit - Maximum number of users to return
 * @returns {object} Array of users
 */
async function getAllUsers(limit = 50) {
    try {
        const { data: users, error } = await supabase
            .from('user_profile')
            .select('user_id, name, email, phone, card_id, balance, address, card_type, dob, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        // Format the data
        const formattedUsers = users.map(user => ({
            ...user,
            dob_formatted: user.dob ? new Date(user.dob).toISOString().split('T')[0] : null,
            created_at_formatted: user.created_at ? new Date(user.created_at).toISOString().replace('T', ' ').split('.')[0] : null
        }));

        return {
            success: true,
            users: formattedUsers,
            total: formattedUsers.length
        };

    } catch (err) {
        throw new Error(`Error fetching users: ${err.message}`);
    }
}

/**
 * Update user balance
 * @param {string} userId - User ID
 * @param {number} newBalance - New balance amount
 * @returns {object} Updated user data
 */
async function updateUserBalance(userId, newBalance) {
    if (isNaN(newBalance) || newBalance < 0) {
        throw new Error('Valid balance amount is required');
    }

    try {
        const { data: updatedUser, error } = await supabase
            .from('user_profile')
            .update({ balance: parseFloat(newBalance) })
            .eq('user_id', userId)
            .select('user_id, name, email, balance')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('User not found');
            }
            throw new Error(`Database error: ${error.message}`);
        }

        return {
            success: true,
            message: 'Balance updated successfully',
            user: updatedUser
        };

    } catch (err) {
        throw new Error(`Error updating balance: ${err.message}`);
    }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of start point
 * @param {number} lng1 - Longitude of start point
 * @param {number} lat2 - Latitude of end point
 * @param {number} lng2 - Longitude of end point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 */
function toRad(value) {
    return value * Math.PI / 180;
}

/**
 * Calculate fare based on distance and vehicle type using progressive rates
 * @param {number} distance - Distance in kilometers
 * @param {string} vehicleType - Type of vehicle (bus, express, metro, tram)
 * @returns {object} Fare calculation details
 */
function calculateProgressiveFare(distance, vehicleType = 'bus') {
    const rates = FARE_RATES[vehicleType] || FARE_RATES.bus;
    
    // Calculate base fare + distance-based fare
    let fare = rates.baseFare + (distance * rates.perKmRate);
    
    // Apply min/max fare limits
    fare = Math.max(rates.minFare, Math.min(fare, rates.maxFare));
    
    return {
        distance: distance,
        vehicleType: vehicleType,
        baseFare: rates.baseFare,
        distanceFare: distance * rates.perKmRate,
        totalFare: Math.round(fare),
        perKmRate: rates.perKmRate,
        calculation: `Base: ${rates.baseFare} + Distance: ${distance}km × ${rates.perKmRate} = ${Math.round(fare)} BDT`
    };
}

/**
 * Calculate fare based on distance bands
 * @param {number} distance - Distance in kilometers
 * @param {string} vehicleType - Type of vehicle
 * @returns {object} Fare calculation details
 */
function calculateBandedFare(distance, vehicleType = 'bus') {
    const band = DISTANCE_BANDS.find(b => distance >= b.minKm && distance < b.maxKm);
    
    if (!band) {
        // Fallback to last band
        const lastBand = DISTANCE_BANDS[DISTANCE_BANDS.length - 1];
        return {
            distance: distance,
            vehicleType: vehicleType,
            fare: lastBand.fare[vehicleType] || lastBand.fare.bus,
            band: `${lastBand.minKm}+ km`,
            calculation: `Distance band: ${lastBand.minKm}+ km = ${lastBand.fare[vehicleType] || lastBand.fare.bus} BDT`
        };
    }
    
    return {
        distance: distance,
        vehicleType: vehicleType,
        fare: band.fare[vehicleType] || band.fare.bus,
        band: `${band.minKm}-${band.maxKm === Infinity ? '+' : band.maxKm} km`,
        calculation: `Distance band: ${band.minKm}-${band.maxKm === Infinity ? '+' : band.maxKm} km = ${band.fare[vehicleType] || band.fare.bus} BDT`
    };
}

/**
 * Calculate fare for a journey with multiple stops
 * @param {Array} coordinates - Array of {lat, lng} coordinates
 * @param {string} vehicleType - Type of vehicle
 * @param {string} fareModel - 'progressive' or 'banded'
 * @returns {object} Complete journey fare details
 */
function calculateJourneyFare(coordinates, vehicleType = 'bus', fareModel = 'progressive') {
    if (!coordinates || coordinates.length < 2) {
        return {
            error: 'At least 2 coordinates required for fare calculation',
            totalFare: 0,
            totalDistance: 0
        };
    }
    
    let totalDistance = 0;
    const segments = [];
    
    // Calculate distance for each segment
    for (let i = 0; i < coordinates.length - 1; i++) {
        const start = coordinates[i];
        const end = coordinates[i + 1];
        
        const segmentDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
        totalDistance += segmentDistance;
        
        segments.push({
            from: start,
            to: end,
            distance: segmentDistance,
            segment: i + 1
        });
    }
    
    // Calculate fare based on selected model
    let fareDetails;
    if (fareModel === 'banded') {
        fareDetails = calculateBandedFare(totalDistance, vehicleType);
    } else {
        fareDetails = calculateProgressiveFare(totalDistance, vehicleType);
    }
    
    return {
        totalDistance: totalDistance,
        segments: segments,
        fareModel: fareModel,
        fareDetails: fareDetails,
        totalFare: fareDetails.totalFare || fareDetails.fare,
        vehicleType: vehicleType,
        timestamp: new Date().toISOString()
    };
}

/**
 * Apply discounts based on passenger type
 * @param {number} baseFare - Base calculated fare
 * @param {string} passengerType - Type of passenger (student, senior, disabled, regular)
 * @returns {object} Fare with discount applied
 */
function applyDiscount(baseFare, passengerType = 'regular') {
    const discounts = {
        student: 0.5,    // 50% discount
        senior: 0.3,     // 30% discount
        disabled: 0.7,   // 70% discount
        child: 0.5,      // 50% discount
        regular: 0       // No discount
    };
    
    const discountRate = discounts[passengerType] || 0;
    const discountAmount = Math.round(baseFare * discountRate);
    const finalFare = baseFare - discountAmount;
    
    return {
        baseFare: baseFare,
        passengerType: passengerType,
        discountRate: discountRate * 100, // Convert to percentage
        discountAmount: discountAmount,
        finalFare: finalFare,
        savings: discountAmount
    };
}

/**
 * Calculate fare for a specific user with automatic discount
 * @param {string} cardId - User's card ID
 * @param {number} distance - Distance traveled in kilometers
 * @param {string} vehicleType - Type of vehicle (bus, train, etc.)
 * @returns {object} Fare calculation with discount applied
 */
async function calculateFareForUser(cardId, distance, vehicleType = 'bus') {
    try {
        // Get user data to determine card type
        const user = await getUserByCardId(cardId);
        if (!user) {
            throw new Error('User not found');
        }

        // Calculate base fare based on distance
        const baseFare = calculateProgressiveFare(distance, vehicleType);
        
        // Apply discount based on user's card type
        const fareWithDiscount = applyDiscount(baseFare, user.card_type);
        
        return {
            ...fareWithDiscount,
            distance: distance,
            vehicleType: vehicleType,
            userName: user.name,
            cardId: user.card_id,
            cardType: user.card_type
        };

    } catch (err) {
        throw new Error(`Error calculating fare for user: ${err.message}`);
    }
}

/**
 * Get current travel data for all users
 * @returns {Promise<Array>} List of current travels
 */
async function getAllCurrentTravels() {
    try {
        const { data, error } = await supabase
            .from('CURRENT_TRAVEL')
            .select(`
                *,
                USER_PROFILE:user_id (
                    name,
                    card_id,
                    card_type
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        throw new Error(`Error fetching current travels: ${err.message}`);
    }
}

/**
 * Get travel history with user details
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} List of travel history
 */
async function getTravelHistory(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('TRAVEL_HISTORY')
            .select(`
                *,
                USER_PROFILE:user_id (
                    name,
                    card_id,
                    card_type
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        throw new Error(`Error fetching travel history: ${err.message}`);
    }
}

/**
 * Get all bus information
 * @returns {Promise<Array>} List of buses
 */
async function getAllBuses() {
    try {
        const { data, error } = await supabase
            .from('BUS_INFO')
            .select('*')
            .order('bus_id', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        throw new Error(`Error fetching bus information: ${err.message}`);
    }
}

/**
 * Update bus status (active/inactive)
 * @param {number} busId - Bus ID
 * @param {boolean} isActive - New status
 * @returns {Promise<Object>} Updated bus data
 */
async function updateBusStatus(busId, isActive) {
    try {
        const { data, error } = await supabase
            .from('BUS_INFO')
            .update({ is_active: isActive })
            .eq('bus_id', busId)
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        throw new Error(`Error updating bus status: ${err.message}`);
    }
}

/**
 * Get recharge history
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} List of recharge history
 */
async function getRechargeHistory(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('RECHARGE_HISTORY')
            .select(`
                *,
                USER_PROFILE:user_id (
                    name,
                    card_id,
                    card_type
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        throw new Error(`Error fetching recharge history: ${err.message}`);
    }
}

/**
 * Create a new travel entry
 * @param {number} userId - User ID
 * @param {number} busId - Bus ID
 * @param {string} startLocation - Starting location
 * @param {string} endLocation - Ending location (optional)
 * @param {number} distance - Distance in km (optional)
 * @returns {Promise<Object>} Created travel entry
 */
async function createTravelEntry(userId, busId, startLocation, endLocation = null, distance = null) {
    try {
        const { data, error } = await supabase
            .from('CURRENT_TRAVEL')
            .insert({
                user_id: userId,
                bus_id: busId,
                start_location: startLocation,
                end_location: endLocation,
                distance: distance,
                start_time: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        throw new Error(`Error creating travel entry: ${err.message}`);
    }
}

/**
 * Complete a travel entry
 * @param {number} travelId - Travel ID
 * @param {string} endLocation - End location
 * @param {number} distance - Total distance
 * @returns {Promise<Object>} Completed travel entry
 */
async function completeTravelEntry(travelId, endLocation, distance) {
    try {
        // Get the current travel entry
        const { data: currentTravel, error: fetchError } = await supabase
            .from('CURRENT_TRAVEL')
            .select('*')
            .eq('id', travelId)
            .single();

        if (fetchError) throw fetchError;

        // Calculate fare
        const fareResult = await calculateFareForUser(currentTravel.user_id, distance);

        // Move to travel history
        const { data: historyData, error: historyError } = await supabase
            .from('TRAVEL_HISTORY')
            .insert({
                user_id: currentTravel.user_id,
                bus_id: currentTravel.bus_id,
                start_location: currentTravel.start_location,
                end_location: endLocation,
                start_time: currentTravel.start_time,
                end_time: new Date().toISOString(),
                distance: distance,
                fare: fareResult.fare,
                card_type: fareResult.cardType
            })
            .select();

        if (historyError) throw historyError;

        // Update user balance
        await updateUserBalance(currentTravel.user_id, -fareResult.fare);

        // Remove from current travel
        const { error: deleteError } = await supabase
            .from('CURRENT_TRAVEL')
            .delete()
            .eq('id', travelId);

        if (deleteError) throw deleteError;

        return historyData[0];
    } catch (err) {
        throw new Error(`Error completing travel entry: ${err.message}`);
    }
}

/**
 * Get fare estimate for display purposes
 * @param {number} distance - Distance in kilometers
 * @param {string} vehicleType - Type of vehicle
 * @returns {string} Formatted fare estimate
 */
function getFareEstimate(distance, vehicleType = 'bus') {
    const progressive = calculateProgressiveFare(distance, vehicleType);
    const banded = calculateBandedFare(distance, vehicleType);
    
    return {
        progressive: `৳${progressive.totalFare}`,
        banded: `৳${banded.fare}`,
        range: `৳${Math.min(progressive.totalFare, banded.fare)}-${Math.max(progressive.totalFare, banded.fare)}`
    };
}

module.exports = {
    // Fare calculation functions
    calculateDistance,
    calculateProgressiveFare,
    calculateBandedFare,
    calculateJourneyFare,
    applyDiscount,
    getFareEstimate,
    calculateFareForUser,
    FARE_RATES,
    DISTANCE_BANDS,
    
    // User management functions
    createUser,
    getUserByCardId,
    getAllUsers,
    updateUserBalance,
    generateCardId,
    validateEmail,
    validatePhone,
    validateCardNumber,
    
    // Admin transit functions
    getAllCurrentTravels,
    getTravelHistory,
    getAllBuses,
    updateBusStatus,
    getRechargeHistory,
    createTravelEntry,
    completeTravelEntry
};
