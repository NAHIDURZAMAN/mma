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

router.get('/:id', requireloginuser, async (req, res) => { 

    const get_id = req.params.id;
   
   
    let connection;
    try{
        connection = await OracleDB.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM USER_PROFILE WHERE USER_ID = :get_id`,
            {get_id}
        );
        const user_data = result.rows;
      console.log(req.query);
        if(req.session.cardID && req.query.request==='json'){
          
           const current_longitude=req.query.lang;
           const current_latitude=req.query.let
           const pick_point=req.query.pick_point;
              
                await connection.execute(
                  `INSERT INTO CURRENT_TRAVEL (TRAVEL_ID, USER_ID, PICK_POINT, CURRENT_LONGITUDE, CURRENT_LATITUDE) 
                   VALUES (:travel_id, :get_id, :pick_point, :current_longitude, :current_latitude)`,
                  {
                    travel_id: uuid(),
                    get_id,
                    pick_point,
                    current_longitude,
                    current_latitude
                  },{autoCommit:true}
                );
               
             
        }
     
        
        console.log(result.rows);
        res.render('user', { user_data,get_id});
    }
    catch (err) {
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


   
}
);
/////////////////current trip/////////////////////
router.get('/:id/currenttrip', requirecard, async (req, res) => {
 
}
);

router.post('/:id/location', requireloginuser, async (req, res) => {
    const get_id = req.params.id;
    const {lat,lang}=req.query;
    console.log(lat,lang);
    console.log('the user id is ',get_id);
    // let connection;
    // try{
    //     connection = await OracleDB.getConnection(dbConfig);
    //     const result = await connection.execute(
    //         `SELECT * FROM USER_PROFILE WHERE USER_ID = :get_id`,
    //         {get_id}
    //     );
    //     const user_data = result.rows;
     
        
    //     console.log(result.rows);
    //     res.render('location', { user_data});
    // }
    // catch (err) {
    //     console.error(err);
    //     res.status(500).send('Error getting user profile');
    // } finally {
    //     if (connection) {
    //         try {
    //             await connection.close();
    //         } catch (err) {
    //             console.error(err);
    //         }
    //     }
    // }
}
);
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