const express = require('express');
const { exec } = require('child_process'); // To execute system commands
const os = require('os'); // To retrieve network information
const path = require('path');
const methodOverride = require('method-override');

// Initialize express app
const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public', 'ejs'));
app.set('view engine', 'ejs'); // Set EJS as the template engine

// Function to get the local Wi-Fi IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let wifiIp = null;

  for (let interfaceName in interfaces) {
    for (let iface of interfaces[interfaceName]) {
      // Check if it's an IPv4 address and not internal (i.e., not localhost)
      if (iface.family === 'IPv4' && !iface.internal) {
        wifiIp = iface.address;
        break;
      }
    }
    if (wifiIp) break; // Exit loop if we've found the Wi-Fi IP
  }
  console.log(`Local Wi-Fi IP: ${wifiIp}`);
  return wifiIp;
}

// Route to handle RFID scan
// app.get('/rfid-scan', (req, res) => {


  



//   console.log('Listening for RFID scans');
//   res.render('index'); // Ensure you have 'index.ejs' in the views directory
// });








app.get('/home', (req, res) => {
  res.render('n');
}
);



app.get('/rfid-scan', (req, res) => {
  console.log(req.query);
  const cardID = req.body.cardID;
  

  // Get the Wi-Fi IP dynamically
  const wifiIp = getLocalIp();
  if (!wifiIp) {
    console.error('Could not determine the local Wi-Fi IP address.');
    res.status(500).send('Error determining local Wi-Fi IP');
    return;
  }

  // Log the Wi-Fi IP to the console
  console.log(`Local Wi-Fi IP Address: ${wifiIp}`);

  // Dynamically construct the URL based on the Wi-Fi IP
  const url = `http://localhost:3000/home`; // You can modify the port or path as needed

  // Use exec to open the URL in the default browser (Windows example)
  exec(`start ${url}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error opening URL: ${stderr}`);
      res.status(500).send('Error opening the website');
    } else {
      console.log(`Website opened: ${url}`);
      res.send('Website opened successfully');
    }
  });
});















// Start the server
 // Use an environment variable for the port
app.listen(2000, () => {
  const wifiIp = getLocalIp();
  console.log(`Node.js server is running on port 3000...`);
  console.log(`Wi-Fi IP: ${wifiIp}`);
});
