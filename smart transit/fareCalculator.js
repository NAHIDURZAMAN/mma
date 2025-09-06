/**
 * Distance-based Fare Calculator for Smart Transit System
 * Calculates fare based on distance traveled between stations
 */

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

export {
    calculateDistance,
    calculateProgressiveFare,
    calculateBandedFare,
    calculateJourneyFare,
    applyDiscount,
    getFareEstimate,
    FARE_RATES,
    DISTANCE_BANDS
};
