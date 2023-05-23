const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const scannersDir = path.join(__dirname, 'scanners');
const scannersFilePath = path.join(__dirname, 'scanners.json');
console.log('scannersDir:', scannersDir);
console.log('scannersFilePath:', scannersFilePath);

let scanners = [];

// Create a socket server for each scanner
function createSocketServer(scanner) {
  const { name, host, port } = scanner;

  const socket = net.createConnection(port, host, () => {
    console.log(`Connected to scanner ${name} at ${host}:${port}`);
  });

  let barcodeData = ''; // Accumulate barcode data

  socket.on('data', (data) => {
    const newData = data.toString().trim();

    // Check if the accumulated barcode data plus new data results in a complete barcode
    const completeBarcode = checkCompleteBarcode(barcodeData + newData);

    if (completeBarcode) {
      const barcode = barcodeData + newData;
      const scannerName = name;

      // Create directory for scanner (if it doesn't exist)
      const scannerDir = path.join(scannersDir, scannerName);
      if (!fs.existsSync(scannerDir)) {
        fs.mkdirSync(scannerDir, { recursive: true });
      }

      // Process and save the barcode data to XML file
      const currentDate = moment().format('YYYY-MM-DD');
      const fileName = `${scannerName}_${currentDate}.xml`;
      const filePath = path.join(scannerDir, fileName);

      const xmlData = `<BarcodeData><Barcode>${barcode}</Barcode></BarcodeData>`;

      fs.appendFileSync(filePath, xmlData);

      barcodeData = ''; // Reset accumulated barcode data for the next barcode
    } else {
      barcodeData += newData; // Append new data to accumulated barcode data
    }
  });

  socket.on('error', (error) => {
    console.error(`Error occurred for scanner ${name} at ${host}:${port}:`, error);
  });
}

// Function to check if the accumulated data forms a complete barcode
function checkCompleteBarcode(data) {
  // Modify this function to implement the logic for checking if the data forms a complete barcode
  // You can check for a specific length, end-of-line character, or any other pattern that indicates a complete barcode
  // Return true if a complete barcode is detected, otherwise return false

  // Example: Check for a specific length of barcode
  return data.length >= 10;
}


// Load scanners from file on server start
function loadScannersFromFile() {
  if (fs.existsSync(scannersFilePath)) {
    const scannersData = fs.readFileSync(scannersFilePath, 'utf8');
    scanners = JSON.parse(scannersData);

    // Create socket server for each scanner
    scanners.forEach((scanner) => {
      createSocketServer(scanner);
    });
  }
}

// Save scanners to file
function saveScannersToFile() {
  const scannersData = JSON.stringify(scanners);
  fs.writeFileSync(scannersFilePath, scannersData, 'utf8');
}

// Set up the views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Default route for the root path
app.route('/')
  .get((req, res) => {
    const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.render('user/users', { scanners: sortedScanners, selectedScanners: [] }); // Pass an empty array initially
  })
  .post((req, res) => {
    const selectedScanners = req.body.scanners || []; // Retrieve the selected scanners from the form submission
    // Process the selected scanners as needed
    // Example: Save the selected scanners to a file or perform other operations

    // Render the users.ejs view with the selected scanners
    const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.render('user/users', { scanners: sortedScanners, selectedScanners });
  });

// Route to render the admin control panel
app.get('/admin', (req, res) => {
  const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const scannerExists = req.query.scannerExists; // Retrieve the value from the query parameter
  res.render('admin/admin', { scanners: sortedScanners, scannerExists });
});

// Route to handle scanner configuration form submission
app.post('/config', (req, res) => {
  const { name, host, port } = req.body;
  const scanner = {
    name,
    host,
    port: parseInt(port),
  };

  // Check if the scanner already exists
  const existingScanner = scanners.find((s) => s.name === name);
  if (existingScanner) {
    const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.render('admin/admin', { scanners: sortedScanners, scannerExists: name });
    return;
  }

  scanners.push(scanner);
  saveScannersToFile(); // Save scanners to file
  createSocketServer(scanner); // Create socket server for the new scanner
  res.redirect('/admin'); // Redirect to refresh the admin panel
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  loadScannersFromFile(); // Load scanners from file and create socket servers on server start
});
