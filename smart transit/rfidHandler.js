/**
 * RFID Card Handler with Distance-based Fare Calculation
 * Handles RFID card scanning, passenger boarding/alighting, and fare deduction
 */

const { createClient } = require('@supabase/supabase-js');
const { 
    calculateDistance, 
    calculateJourneyFare, 
    applyDiscount,
    FARE_RATES 
} = require('./fareCalculator');
const emailService = require('./Routes/email');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Handle RFID card scan
 * @param {string} rfidCode - RFID card code
 * @param {object} stationLocation - Current station coordinates {lat, lng, name}
 * @param {string} vehicleType - Type of vehicle
 * @param {string} vehicleId - Vehicle identifier
 * @returns {object} Scan result
 */
async function handleRFIDScan(rfidCode, stationLocation, vehicleType = 'bus', vehicleId = 'BUS001') {
    try {
        console.log('🏷️ RFID Scan:', { rfidCode, station: stationLocation.name, vehicleType });
        
        // 1. Get user profile
        const { data: userProfile, error: userError } = await supabase
            .from('USER_PROFILE')
            .select('*')
            .eq('rfid_code', rfidCode)
            .single();
            
        if (userError || !userProfile) {
            return {
                success: false,
                message: 'Invalid RFID card or user not found',
                error: userError?.message
            };
        }
        
        // 2. Check current balance
        if (userProfile.balance <= 0) {
            return {
                success: false,
                message: 'Insufficient balance. Please recharge your card.',
                user: userProfile
            };
        }
        
        // 3. Check if user is currently traveling
        const { data: currentTravel, error: travelError } = await supabase
            .from('CURRENT_TRAVEL')
            .select('*')
            .eq('user_id', userProfile.user_id)
            .eq('status', 'active')
            .single();
            
        if (currentTravel) {
            // User is alighting (ending journey)
            return await handleAlighting(userProfile, currentTravel, stationLocation, vehicleType, vehicleId);
        } else {
            // User is boarding (starting journey)
            return await handleBoarding(userProfile, stationLocation, vehicleType, vehicleId);
        }
        
    } catch (error) {
        console.error('❌ RFID scan error:', error);
        return {
            success: false,
            message: 'System error during RFID scan',
            error: error.message
        };
    }
}

/**
 * Handle passenger boarding
 */
async function handleBoarding(userProfile, stationLocation, vehicleType, vehicleId) {
    try {
        console.log('🚌 Passenger boarding:', userProfile.full_name);
        
        // Deduct base fare or minimum fare for boarding
        const baseRate = FARE_RATES[vehicleType] || FARE_RATES.bus;
        const boardingFare = baseRate.baseFare;
        
        // Apply discount if applicable
        const fareWithDiscount = applyDiscount(boardingFare, userProfile.passenger_type || 'regular');
        const finalBoardingFare = fareWithDiscount.finalFare;
        
        // Check if user has enough balance for base fare
        if (userProfile.balance < finalBoardingFare) {
            return {
                success: false,
                message: `Insufficient balance. Required: ৳${finalBoardingFare}, Available: ৳${userProfile.balance}`,
                user: userProfile
            };
        }
        
        // Create current travel record
        const { data: travelRecord, error: travelError } = await supabase
            .from('CURRENT_TRAVEL')
            .insert({
                user_id: userProfile.user_id,
                vehicle_id: vehicleId,
                vehicle_type: vehicleType,
                boarding_station: stationLocation.name,
                boarding_location: `${stationLocation.lat},${stationLocation.lng}`,
                boarding_time: new Date().toISOString(),
                status: 'active',
                base_fare_paid: finalBoardingFare
            })
            .select()
            .single();
            
        if (travelError) {
            throw new Error(`Failed to create travel record: ${travelError.message}`);
        }
        
        // Deduct base fare from user balance
        const { error: balanceError } = await supabase
            .from('USER_PROFILE')
            .update({ 
                balance: userProfile.balance - finalBoardingFare,
                last_travel_date: new Date().toISOString()
            })
            .eq('user_id', userProfile.user_id);
            
        if (balanceError) {
            throw new Error(`Failed to update balance: ${balanceError.message}`);
        }
        
        // Send boarding confirmation email
        await sendBoardingEmail(userProfile, {
            station: stationLocation.name,
            vehicleType: vehicleType,
            vehicleId: vehicleId,
            farePaid: finalBoardingFare,
            remainingBalance: userProfile.balance - finalBoardingFare,
            discount: fareWithDiscount.discountAmount > 0 ? fareWithDiscount : null
        });
        
        return {
            success: true,
            action: 'boarding',
            message: `Welcome aboard! Base fare ৳${finalBoardingFare} deducted.`,
            user: {
                ...userProfile,
                balance: userProfile.balance - finalBoardingFare
            },
            fareDetails: fareWithDiscount,
            travelRecord: travelRecord
        };
        
    } catch (error) {
        console.error('❌ Boarding error:', error);
        return {
            success: false,
            message: 'Error during boarding process',
            error: error.message
        };
    }
}

/**
 * Handle passenger alighting
 */
async function handleAlighting(userProfile, currentTravel, stationLocation, vehicleType, vehicleId) {
    try {
        console.log('🚏 Passenger alighting:', userProfile.full_name);
        
        // Calculate journey distance
        const boardingCoords = currentTravel.boarding_location.split(',');
        const boardingLat = parseFloat(boardingCoords[0]);
        const boardingLng = parseFloat(boardingCoords[1]);
        
        const distance = calculateDistance(
            boardingLat, 
            boardingLng, 
            stationLocation.lat, 
            stationLocation.lng
        );
        
        // Calculate total fare based on distance
        const journeyFare = calculateJourneyFare([
            { lat: boardingLat, lng: boardingLng },
            { lat: stationLocation.lat, lng: stationLocation.lng }
        ], vehicleType, 'progressive');
        
        // Apply discount
        const fareWithDiscount = applyDiscount(journeyFare.totalFare, userProfile.passenger_type || 'regular');
        const totalFareRequired = fareWithDiscount.finalFare;
        
        // Calculate additional fare needed (total fare - base fare already paid)
        const baseFarePaid = currentTravel.base_fare_paid || 0;
        const additionalFareNeeded = Math.max(0, totalFareRequired - baseFarePaid);
        
        // Check if user has enough balance for additional fare
        if (additionalFareNeeded > 0 && userProfile.balance < additionalFareNeeded) {
            return {
                success: false,
                message: `Insufficient balance for additional fare. Required: ৳${additionalFareNeeded}, Available: ৳${userProfile.balance}`,
                user: userProfile,
                fareDetails: {
                    totalFare: totalFareRequired,
                    baseFarePaid: baseFarePaid,
                    additionalNeeded: additionalFareNeeded,
                    distance: distance
                }
            };
        }
        
        // Deduct additional fare if needed
        let newBalance = userProfile.balance;
        if (additionalFareNeeded > 0) {
            newBalance = userProfile.balance - additionalFareNeeded;
            
            const { error: balanceError } = await supabase
                .from('USER_PROFILE')
                .update({ 
                    balance: newBalance,
                    last_travel_date: new Date().toISOString()
                })
                .eq('user_id', userProfile.user_id);
                
            if (balanceError) {
                throw new Error(`Failed to update balance: ${balanceError.message}`);
            }
        }
        
        // Complete the travel record
        const { error: completeError } = await supabase
            .from('CURRENT_TRAVEL')
            .update({
                alighting_station: stationLocation.name,
                alighting_location: `${stationLocation.lat},${stationLocation.lng}`,
                alighting_time: new Date().toISOString(),
                status: 'completed',
                total_distance: distance,
                additional_fare: additionalFareNeeded,
                total_fare_paid: baseFarePaid + additionalFareNeeded
            })
            .eq('travel_id', currentTravel.travel_id);
            
        if (completeError) {
            throw new Error(`Failed to complete travel record: ${completeError.message}`);
        }
        
        // Move to travel history
        const { error: historyError } = await supabase
            .from('TRAVEL_HISTORY')
            .insert({
                user_id: userProfile.user_id,
                vehicle_id: vehicleId,
                vehicle_type: vehicleType,
                boarding_station: currentTravel.boarding_station,
                alighting_station: stationLocation.name,
                boarding_time: currentTravel.boarding_time,
                alighting_time: new Date().toISOString(),
                total_distance: distance,
                total_fare: baseFarePaid + additionalFareNeeded,
                base_fare: baseFarePaid,
                additional_fare: additionalFareNeeded
            });
            
        if (historyError) {
            console.error('Error saving to history:', historyError);
        }
        
        // Send journey completion email
        await sendJourneyCompletionEmail(userProfile, {
            boardingStation: currentTravel.boarding_station,
            alightingStation: stationLocation.name,
            distance: distance,
            totalFare: baseFarePaid + additionalFareNeeded,
            baseFare: baseFarePaid,
            additionalFare: additionalFareNeeded,
            vehicleType: vehicleType,
            vehicleId: vehicleId,
            boardingTime: currentTravel.boarding_time,
            alightingTime: new Date().toISOString(),
            remainingBalance: newBalance,
            discount: fareWithDiscount.discountAmount > 0 ? fareWithDiscount : null
        });
        
        return {
            success: true,
            action: 'alighting',
            message: additionalFareNeeded > 0 
                ? `Journey completed! Additional fare ৳${additionalFareNeeded} deducted.`
                : 'Journey completed! No additional fare required.',
            user: {
                ...userProfile,
                balance: newBalance
            },
            journeyDetails: {
                distance: distance,
                totalFare: baseFarePaid + additionalFareNeeded,
                baseFare: baseFarePaid,
                additionalFare: additionalFareNeeded,
                boardingStation: currentTravel.boarding_station,
                alightingStation: stationLocation.name
            },
            fareDetails: fareWithDiscount
        };
        
    } catch (error) {
        console.error('❌ Alighting error:', error);
        return {
            success: false,
            message: 'Error during alighting process',
            error: error.message
        };
    }
}

/**
 * Send boarding confirmation email
 */
async function sendBoardingEmail(user, details) {
    try {
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">🚌 Smart Transit</h1>
                        <p style="color: #6b7280; margin: 5px 0;">Journey Started</p>
                    </div>
                    
                    <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #1e40af; margin: 0 0 15px 0;">Welcome Aboard, ${user.full_name}!</h2>
                        <p style="margin: 0; color: #374151;">You have successfully boarded at <strong>${details.station}</strong></p>
                    </div>
                    
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #374151; margin: 0 0 15px 0;">Trip Details</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Vehicle:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.vehicleType.toUpperCase()} - ${details.vehicleId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Boarding Station:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.station}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Boarding Time:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${new Date().toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #065f46; margin: 0 0 15px 0;">💰 Fare Information</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Base Fare:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">৳${details.farePaid}</td>
                            </tr>
                            ${details.discount ? `
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Discount (${details.discount.passengerType}):</td>
                                <td style="padding: 8px 0; color: #059669; font-weight: bold;">-৳${details.discount.discountAmount}</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Remaining Balance:</td>
                                <td style="padding: 8px 0; color: ${details.remainingBalance < 50 ? '#dc2626' : '#111827'}; font-weight: bold;">৳${details.remainingBalance}</td>
                            </tr>
                        </table>
                        ${details.remainingBalance < 50 ? `
                        <div style="background: #fee2e2; padding: 15px; border-radius: 6px; margin-top: 15px;">
                            <p style="color: #dc2626; margin: 0; font-weight: bold;">⚠️ Low Balance Warning</p>
                            <p style="color: #7f1d1d; margin: 5px 0 0 0; font-size: 14px;">Please recharge your card soon to avoid travel disruptions.</p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">Have a safe journey!</p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">Smart Transit System - Powered by Technology</p>
                    </div>
                </div>
            </div>
        `;
        
        await emailService.sendEmail(
            user.email,
            '🚌 Journey Started - Smart Transit',
            emailContent
        );
        
        console.log('✅ Boarding email sent to:', user.email);
    } catch (error) {
        console.error('❌ Error sending boarding email:', error);
    }
}

/**
 * Send journey completion email
 */
async function sendJourneyCompletionEmail(user, details) {
    try {
        const duration = Math.round((new Date(details.alightingTime) - new Date(details.boardingTime)) / 60000); // minutes
        
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #059669; margin: 0;">🏁 Smart Transit</h1>
                        <p style="color: #6b7280; margin: 5px 0;">Journey Completed</p>
                    </div>
                    
                    <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #065f46; margin: 0 0 15px 0;">Thank you, ${user.full_name}!</h2>
                        <p style="margin: 0; color: #374151;">Your journey has been completed successfully.</p>
                    </div>
                    
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #374151; margin: 0 0 15px 0;">🗺️ Journey Summary</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">From:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.boardingStation}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">To:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.alightingStation}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Distance:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.distance.toFixed(2)} km</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Duration:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${duration} minutes</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Vehicle:</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${details.vehicleType.toUpperCase()} - ${details.vehicleId}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #92400e; margin: 0 0 15px 0;">💳 Fare Breakdown</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Base Fare (at boarding):</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">৳${details.baseFare}</td>
                            </tr>
                            ${details.additionalFare > 0 ? `
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Additional Fare (distance-based):</td>
                                <td style="padding: 8px 0; color: #111827; font-weight: bold;">৳${details.additionalFare}</td>
                            </tr>
                            ` : ''}
                            ${details.discount ? `
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Discount Applied:</td>
                                <td style="padding: 8px 0; color: #059669; font-weight: bold;">-৳${details.discount.discountAmount}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-top: 2px solid #d1d5db;">
                                <td style="padding: 12px 0 8px 0; color: #374151; font-weight: bold;">Total Fare:</td>
                                <td style="padding: 12px 0 8px 0; color: #111827; font-weight: bold; font-size: 18px;">৳${details.totalFare}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Remaining Balance:</td>
                                <td style="padding: 8px 0; color: ${details.remainingBalance < 50 ? '#dc2626' : '#111827'}; font-weight: bold;">৳${details.remainingBalance}</td>
                            </tr>
                        </table>
                        
                        ${details.remainingBalance < 50 ? `
                        <div style="background: #fee2e2; padding: 15px; border-radius: 6px; margin-top: 15px;">
                            <p style="color: #dc2626; margin: 0; font-weight: bold;">⚠️ Low Balance Warning</p>
                            <p style="color: #7f1d1d; margin: 5px 0 0 0; font-size: 14px;">Please recharge your card for future travels.</p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: #ede9fe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #5b21b6; margin: 0 0 15px 0;">📊 Environmental Impact</h3>
                        <p style="color: #374151; margin: 0; font-size: 14px;">
                            By choosing public transport, you've helped reduce carbon emissions by approximately 
                            <strong>${(details.distance * 0.12).toFixed(2)} kg CO₂</strong> compared to private vehicle travel.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">Thank you for choosing Smart Transit!</p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">For support, contact us at support@smarttransit.bd</p>
                    </div>
                </div>
            </div>
        `;
        
        await emailService.sendEmail(
            user.email,
            '🏁 Journey Completed - Smart Transit Receipt',
            emailContent
        );
        
        console.log('✅ Journey completion email sent to:', user.email);
    } catch (error) {
        console.error('❌ Error sending completion email:', error);
    }
}

/**
 * Get current passengers on a vehicle
 */
async function getCurrentPassengers(vehicleId) {
    try {
        const { data: passengers, error } = await supabase
            .from('CURRENT_TRAVEL')
            .select(`
                *,
                USER_PROFILE (
                    full_name,
                    email,
                    passenger_type,
                    balance
                )
            `)
            .eq('vehicle_id', vehicleId)
            .eq('status', 'active');
            
        if (error) {
            throw error;
        }
        
        return {
            success: true,
            passengers: passengers || [],
            count: passengers?.length || 0
        };
    } catch (error) {
        console.error('❌ Error getting passengers:', error);
        return {
            success: false,
            error: error.message,
            passengers: [],
            count: 0
        };
    }
}

module.exports = {
    handleRFIDScan,
    getCurrentPassengers,
    handleBoarding,
    handleAlighting
};
