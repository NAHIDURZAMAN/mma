if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const { exec } = require('child_process'); // To execute system commands
const os = require('os'); // To retrieve network information
const path = require('path');
const methodOverride = require('method-override');
const OracleDB = require('oracledb');
const multer = require('multer');
const { storage } = require('./Routes/cloudinary');
const upload = multer({ storage });
const { v4: uuid } = require('uuid');
const user = require('./Routes/user');
const session = require('express-session'); // Import session
const flash = require('connect-flash'); // Import flash
const app = express();
const sendOtpEmail = require('./Routes/email.js');
const dbConfig = require('./Routes/dbConfig.js');

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public', 'ejs'));
app.set('view engine', 'ejs'); // Set EJS as the template engine

const sessionConfig = {
  secret: 'hey buddy',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
  },
};
app.use(session(sessionConfig));
app.use(flash());
app.use('/user', user);
app.use((req, res, next) => {
  res.locals.login_success = req.flash('login_success');
  res.locals.error = req.flash('error');
  res.locals.id =  req.session.user_id;
  console.log('the user from res',req.session.user_id);
  next();
});


// Function to get the local Wi-Fi IP address
function getWirelessIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // Targeting wireless interfaces (e.g., wlan0, Wi-Fi, etc.)
    if (
      name.toLowerCase().includes('wlan') ||
      name.toLowerCase().includes('wi-fi')
    ) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost'; // Fallback to localhost if no wireless IP is found
}

////////////////////////home page////////////////////////
app.get('/home', (req, res) => {
  if(req.query){
    console.log(req.query);
  }
  res.render('home');
});
///////////////rfid scan/////////////////////
app.get('/rfid-scan', async(req, res) => {
  console.log(req.query);
  const cardID = req.body.cardID;
  let connection;
  try{
      connection = await OracleDB.getConnection(dbConfig);
      const result = await connection.execute(
          `SELECT * FROM USER_PROFILE WHERE  CARD_ID = :cardID`,
          [cardID]
      );
      const user_data = result.rows[0];
      
       
      
       
       
        console.log(result.rows);
      
       
          // Get the Wi-Fi IP dynamically
  const Ip = getWirelessIPAddress();
  if (!Ip) {
    console.error('Could not determine the local Wi-Fi IP address.');
    res.status(500).send('Error determining local Wi-Fi IP');
    return;
  }

  // Log the Wi-Fi IP to the console
  console.log(`Local Wi-Fi IP Address: ${Ip}`);
  let url;

  // Dynamically construct the URL based on the Wi-Fi IP
  if(user_data.length === 0)
  {
    req.flash('error', 'Invalid Credential');
     url = `http://${Ip}:2000/home`; 
  }
  else{
    req.session.cardID = cardID;
    req.session.user_id = user_data.USER_ID;
    const user_id=user_data.USER_ID;
    console.log(req.session.user_id);
    req.flash('login_success', 'successfully logged in');
     url = `http://${Ip}:2000/user_id/${user_id}`;
  }


 // You can modify the port or path as needed

  // Use exec to open the URL in the default browser (Windows example)
  exec(`start ${url}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error opening URL: ${stderr}`);
      res.status(500).send('Error opening the website');
    } else {
      console.log(`Website opened: ${url}`);
      res.redirect(`${url}`);
    }
  });


      
     
   
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




});


/////////////////////////login////////////////////////
app.get('/home/login', (req, res) => {
  res.render('login');
});
/////////////////////////login post////////////////////////
app.post('/home/login', async (req, res) => {
  const { user_id, password } = req.body;
  console.log(req.body);
  let connection;
  try {
    connection = await OracleDB.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT * FROM USER_PROFILE WHERE (user_id = :user_id or card_id=:user_id) AND PASSWORD = :password`,
      {user_id,user_id, password}
   
    );
    const user_data = result.rows[0];
    console.log(user_data);
    if (user_data.length === 0) {
      req.flash('error', 'Invalid Credential');
      res.redirect('/home/login');
    } else {
      req.session.user_id = user_data.USER_ID;
      req.session.cardID = user_data.CARD_ID;
      console.log(req.session.user_id);
      res.redirect(`/user/${user_data.USER_ID}`);
    }
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
}
);



// Start the server

app.listen(2000, () => {
  console.log(`YOUR IP IS ${getWirelessIPAddress()}`);

  console.log(`Node.js server is running on port 2000...`);
  
});