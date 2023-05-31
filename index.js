const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const xmlParser = require('./xmlparser.js');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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
      const fileName = `${scannerName}~${currentDate}.xml`;
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

// Function to retrieve the latest XML data from a file
async function getLatestXmlDataFromFile(scanner) {
  console.log('Fetching latest XML data from file for scanner:', scanner); // Log the scanner for which XML data is being fetched

  return new Promise((resolve, reject) => {
    // Create the file path for the scanner's XML data
    const filePath = path.join(scannersDir, scanner.name);

    // Read the directory contents to get the list of XML files
    fs.readdir(filePath, (err, files) => {
      if (err) {
        console.error('Error occurred while reading XML files for scanner:', scanner.name);
        reject(err);
      } else {
        // Sort the files based on modification time to get the latest file
        const sortedFiles = files.sort((a, b) => {
          const fileA = fs.statSync(path.join(filePath, a));
          const fileB = fs.statSync(path.join(filePath, b));
          return fileB.mtime.getTime() - fileA.mtime.getTime();
        });

        if (sortedFiles.length > 0) {
          const latestFilePath = path.join(filePath, sortedFiles[0]);

          // Read the content of the latest XML file
          fs.readFile(latestFilePath, 'utf8', (error, data) => {
            if (error) {
              console.error('Error occurred while reading latest XML data from file for scanner:', scanner.name);
              reject(error);
            } else {
              console.log('Read latest XML data from file for scanner:', scanner.name);
              console.log('XML Data:', data); // Log the read XML data
              resolve(data);
            }
          });
        } else {
          // No XML files found for the scanner
          console.log('No XML data available for scanner:', scanner.name);
          resolve(null);
        }
      }
    });
  });
}

// Load scanners from file on server start
function loadScannersFromFile() {
  if (fs.existsSync(scannersFilePath)) {
    const scannersData = fs.readFileSync(scannersFilePath, 'utf8');
    console.log('scannersData:', scannersData); // Check the value of scannersData
    scanners = JSON.parse(scannersData);
    console.log('scanners:', scanners); // Check the value of scanners

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

// Function to parse and handle XML data
async function handleXmlData() {
  const xmlData = [];

  for (const scanner of scanners) {
    console.log('Processing scanner:', scanner.name); // Log the scanner being processed

    try {
      const scannerXmlData = await getLatestXmlDataFromFile(scanner);
      const parsedXmlData = await xmlParser.parseXml(scannerXmlData);

      const extractedInfo = xmlParser.extractInformation(parsedXmlData);
      xmlData.push({
        scanner: scanner.name,
        xmlData: extractedInfo,
      });

      console.log('Retrieved and parsed latest XML data from file for scanner:', scanner.name);

      // Include the code snippet here
      console.log('Extracted information:');
      console.log(extractedInfo);
    } catch (error) {
      console.error('Error occurred while retrieving and parsing latest XML data from file for scanner:', scanner.name);
      console.error(error);
    }
  }

  console.log('Final XML data:', xmlData); // Log the final XML data

  // Return the XML data as a JSON response or perform any desired action
}

// Watch the XML file for changes
function watchXmlFile() {
  fs.watch(scannersDir, { persistent: true }, (eventType, filename) => {
    if (eventType === 'change' && filename.endsWith('.xml')) {
      console.log(`Detected changes in XML file: ${filename}`);
      handleXmlData();
    }
  });
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
    const selectedScanners = Array.isArray(req.body.selectedScanners) ? req.body.selectedScanners : [];
    console.log('Request body:', req.body); // Log the request body

    // Process the selected scanners as needed
    // Example: Save the selected scanners to a file or perform other operations

    // Placeholder comment: Add your processing logic here

    // Render the users.ejs view with the selected scanners
    const sortedScanners = scanners.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.render('user/users', { scanners: sortedScanners, selectedScanners });

    // Display the scanner data on the page (example: replace 'console.log' with the appropriate code)
    const selectedScannersList = document.getElementById('selectedScannersList');
    selectedScannersList.innerHTML = ''; // Clear the existing list

    if (selectedScanners.length > 0) {
      selectedScanners.forEach((scanner) => {
        const listItem = document.createElement('li');
        listItem.textContent = scanner;
        selectedScannersList.appendChild(listItem);
      });
    } else {
      const noScannersMessage = document.createElement('li');
      noScannersMessage.textContent = 'No scanners selected.';
      selectedScannersList.appendChild(noScannersMessage);
    }

    // Refresh the page to clear the form (optional)
    // window.location.reload();
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

  scanners.push(scanner);
  saveScannersToFile(); // Save scanners to file
  createSocketServer(scanner); // Create socket server for the new scanner
  res.redirect('/admin'); // Redirect to refresh the admin panel
});

// Route to handle selected scanner form submission
app.post('/selected-scanners', async (req, res) => {
  console.log('Request body:', req.body); // Log the request body

  let selectedScannersNames = req.body.selectedScanners;
  if (!Array.isArray(selectedScannersNames)) {
    selectedScannersNames = [selectedScannersNames];
  }

  console.log('Selected scanners:', selectedScannersNames); // Log the selected scanners

  const xmlData = [];

  for (const scannerName of selectedScannersNames) {
    console.log('Processing scanner:', scannerName); // Log the scanner being processed

    const scanner = scanners.find((s) => s.name === scannerName);
    if (!scanner) {
      console.log(`Scanner ${scannerName} not found`);
      continue;
    }

    try {
      const scannerXmlData = await getLatestXmlDataFromFile(scanner);
      const parsedXmlData = await xmlParser.parseXml(scannerXmlData);

      const extractedInfo = xmlParser.extractInformation(parsedXmlData);
      xmlData.push({
        scanner: scanner.name,
        xmlData: extractedInfo,
      });

      console.log('Retrieved and parsed latest XML data from file for scanner:', scanner.name);

      // Include the code snippet here
      console.log('Extracted information:');
      console.log(extractedInfo);
    } catch (error) {
      console.error('Error occurred while retrieving and parsing latest XML data from file for scanner:', scanner.name);
      console.error(error);
    }
  }

  console.log('Final XML data:', xmlData); // Log the final XML data

  // Return the XML data as a JSON response
  res.json(xmlData);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  loadScannersFromFile(); // Load scanners from file and create socket servers on server start
  handleXmlData(); // Initial handling of XML data
  watchXmlFile(); // Start watching the XML files for changes
});
