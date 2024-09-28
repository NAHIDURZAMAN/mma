const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('./cloudinary');
const upload = multer({ storage });

const { requireloginuser } = require('./requirelogin_middleware');
const { requirecard} = require('./requirelogin_middleware');
const OracleDB = require('oracledb');
const dbConfig = require('./dbConfig');
const { v4: uuid } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

const e = require('connect-flash');










//////////////////////////calculateDistance////////////////////////
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        0.5 - Math.cos(dLat) / 2 + 
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        (1 - Math.cos(dLon)) / 2;

    return R * 2 * Math.asin(Math.sqrt(a));
}

//////////////////////user profile////////////////////////

router.get('/:id', requireloginuser, async (req, res) => { 
    const get_id = req.params.id;

    let connection;
    try {
        connection = await OracleDB.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM USER_PROFILE WHERE USER_ID = :get_id`,
            { get_id }
        );
        const user_data = result.rows[0];
        console.log(req.query);
        console.log('the cardID is ',req.session.cardID);

        if (req.session.cardID && req.query.request === 'json') {
            const current_longitude = req.query.lat; // Keep as string (VARCHAR2)
            const current_latitude = req.query.lng; // Keep as string (VARCHAR2)
            console.log('Current location is', current_longitude, current_latitude);
            const pick_point = req.query.pick_point;

            const currentTravelResult = await connection.execute(
                `SELECT * FROM CURRENT_TRAVEL 
                 WHERE USER_ID = :get_id 
               and TRAVEL_STATUS = 'ONGOING'`,
                { get_id }
            );
              
            const current_travel = currentTravelResult.rows[0]; // Assuming there's only one current travel
            console.log('Current travel ID is', currentTravelResult.rows);

            if (current_travel) {
                console.log('Updating', current_travel.PICK_POINT);

                // Convert to numbers for distance calculation
                const travel_lat = parseFloat(current_travel.CURRENT_LATITUDE);
                const travel_lon = parseFloat(current_travel.CURRENT_LONGITUDE);
                const lat = parseFloat(current_latitude);
                const lon = parseFloat(current_longitude);

                const total_distance = calculateDistance(
                    travel_lat, travel_lon,
                    lat, lon
                );

                const total_cost = Math.ceil(total_distance * 5);
                const balance = user_data.BALANCE;
                console.log('Total cost is', total_cost);

                // Update CURRENT_TRAVEL and calculate cost
                await connection.execute(
                    `UPDATE CURRENT_TRAVEL 
                     SET DROPOFF_LONGITUDE = :current_longitude, 
                         DROPOFF_LATITUDE = :current_latitude, 
                         DROP_POINT = :pick_point,
                         TOTAL_COST = :total_cost,
                         TRAVEL_STATUS = 'completed'
                     WHERE USER_ID = :get_id`,
                    { current_longitude, current_latitude, pick_point, total_cost, get_id },
                    { autoCommit: true }
                );
                
                // Insert into TRAVEL_HISTORY
                await connection.execute(
                    `INSERT INTO TRAVEL_HISTORY (HISTORY_ID, USER_ID, PICK_POINT, DROP_POINT, TRAVEL_DATE, TOTAL_COST, REMAINING_BALANCE) 
                     VALUES (:travel_id, :get_id, :pick_point, :drop_point, SYSDATE, :total_cost, :remaining_balance)`,
                    {
                        travel_id: current_travel.TRAVEL_ID,
                        get_id,
                        pick_point: current_travel.PICK_POINT,
                        drop_point: pick_point,
                        total_cost,
                        remaining_balance: balance - total_cost
                    },
                    { autoCommit: true }
                );
                
                // Update user balance
                await connection.execute(
                    `UPDATE USER_PROFILE 
                     SET BALANCE = :remaining_balance 
                     WHERE USER_ID = :get_id`,
                    { remaining_balance: balance - total_cost, get_id },
                    { autoCommit: true }
                );
                return res.redirect(`/user/${get_id}`);
            } else {
                // Insert new current travel if no ongoing travel
                await connection.execute(
                    `INSERT INTO CURRENT_TRAVEL (TRAVEL_ID, USER_ID, PICK_POINT, CURRENT_LONGITUDE, CURRENT_LATITUDE) 
                     VALUES (:travel_id, :get_id, :pick_point, :current_longitude, :current_latitude)`,
                    {
                        travel_id: uuid(),
                        get_id,
                        pick_point,
                        current_longitude, // Stored as string (VARCHAR2)
                        current_latitude  // Stored as string (VARCHAR2)
                    },
                    { autoCommit: true }
                );
                return res.redirect(`/user/${get_id}`);
            }
        }

        console.log(result.rows);
        res.render('user', { user_data, get_id });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error getting user profile');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

//////////////////////user map////////////////////////
router.get('/:id/map',requireloginuser,async(req,res)=>{
    const get_id = req.params.id;
    if(req.query)
    {
        console.log(req.query);
       

    }

 
    res.render('map',{get_id});
}
);
module.exports = router;