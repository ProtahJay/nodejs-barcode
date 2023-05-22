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

const scannersFilePath = path.join(__dirname, 'scanners.json');

let scanners = [];

// Create a socket server
const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const barcodeData = data.toString().trim();

    // Process and save the barcode data to XML files
    const date = moment().format('YYYY-MM-DD');
    const fileName = `${date}.xml`;
    const filePath = path.join(__dirname, fileName);

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
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Route to render the admin control panel
app.get('/admin', (req, res) => {
  const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  res.render('admin/admin', { scanners: sortedScanners });
});

// Create routes for the web UI
app.get('/config', (req, res) => {
  res.json(scanners);
});

app.post('/config', (req, res) => {
  const { name, host, port } = req.body;
  const scanner = {
    name,
    host,
    port: parseInt(port),
  };
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
