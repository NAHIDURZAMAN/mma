const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('./cloudinary');
const upload = multer({ storage });

const { requireloginuser } = require('./requirelogin_middleware');
const OracleDB = require('oracledb');
const dbConfig = require('./dbConfig');
const { v4: uuid } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');


const e = require('connect-flash');

router.get('/:id',  async (req, res) => { 

    const user_id = req.params.id;
    console.log(user_id);
    let connection;
    try{
        connection = await OracleDB.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM USER_PROFILE WHERE USER_ID = :user_id`,
            [user_id]
        );
        const user_data = result.rows;
        console.log(result.rows);
        res.render('user', { user_data});
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
module.exports = router;