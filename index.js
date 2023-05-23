const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { Builder } = require('xmlbuilder');
const moment = require('moment');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const scannersDir = path.join(__dirname, 'scanners');
const scannersFilePath = path.join(__dirname, 'scanners.json');
console.log('scannersDir:', scannersDir);
console.log('scannersFilePath:', scannersFilePath);

let scanners = [];

// Create a socket server
const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const barcodeData = data.toString().trim();
    const scannerName = socket.remoteAddress + ':' + socket.remotePort;

    // Create directory for scanner (if it doesn't exist)
    const scannerDir = path.join(scannersDir, scannerName);
    if (!fs.existsSync(scannerDir)) {
      fs.mkdirSync(scannerDir);
    }

    // Process and save the barcode data to XML files
    const date = moment().format('YYYY-MM-DD');
    const fileName = `${date}.xml`;
    const filePath = path.join(scannerDir, fileName);

    const xmlRoot = Builder.create('BarcodeData');
    const barcodeElement = xmlRoot.ele('Barcode');
    barcodeElement.txt(barcodeData);

    const xmlString = xmlRoot.end({ pretty: true });

    fs.appendFileSync(filePath, xmlString);
  });
});

// Set up the views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Load scanners from file on server start
function loadScannersFromFile() {
  if (fs.existsSync(scannersFilePath)) {
    const scannersData = fs.readFileSync(scannersFilePath, 'utf8');
    scanners = JSON.parse(scannersData);
  }
}

// Save scanners to file
function saveScannersToFile() {
  const scannersData = JSON.stringify(scanners);
  fs.writeFileSync(scannersFilePath, scannersData, 'utf8');
}

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

// Route to handle errors when adding a scanner
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
  res.redirect('/admin'); // Redirect to refresh the admin panel
});

// Route to remove a scanner
app.post('/remove', (req, res) => {
  const { name } = req.body;
  scanners = scanners.filter((scanner) => scanner.name !== name);
  saveScannersToFile(); // Save scanners to file
  res.redirect('/admin'); // Redirect to refresh the admin panel
});

// Route to create a scanner directory
app.post('/create-directory', (req, res) => {
  const { scannerName } = req.body;
  const scannerDir = path.join(scannersDir, scannerName);

  console.log('Received scannerName:', scannerName);
  console.log('Target directory:', scannerDir);

  if (!fs.existsSync(scannerDir)) {
    fs.mkdirSync(scannerDir);
    console.log('Directory created:', scannerDir);
    res.sendStatus(200);
  } else {
    console.log('Directory already exists:', scannerDir);
    res.status(400).send('Directory already exists');
  }
});

// Start the server and socket
const port = 3000;
const socketPort = 9898; // Socket port for serial I/O

server.listen(socketPort, () => {
  console.log(`Socket server listening on port ${socketPort}`);
  loadScannersFromFile(); // Load scanners from file on server start
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
