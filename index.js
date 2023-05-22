const SerialPort = require('serialport');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const scanners = []; // Empty array to store scanner information

// Connect to the serial over ethernet servers
const serialPorts = scanners.map((scanner) => new SerialPort(scanner));

// Listen for incoming barcode scans
serialPorts.forEach((port) => {
  port.on('data', (data) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const folderPath = path.join(__dirname, `${year}-${month}-${day}`);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const fileName = path.join(folderPath, `${port.path}.txt`);
    fs.appendFileSync(fileName, data.toString());
  });
});

const configDir = path.resolve(__dirname, 'config');

// Set up the views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Create routes for the web UI
app.get('/config', (req, res) => {
  const configFilePath = path.join(configDir, 'config.json');
  const configData = fs.readFileSync(configFilePath, 'utf8');
  res.send(configData);
});

app.post('/config', (req, res) => {
  const configFilePath = path.join(configDir, 'config.json');
  const configData = JSON.stringify(req.body);
  fs.writeFileSync(configFilePath, configData);
  res.send('Config updated');
});

// Route to render the admin control panel
app.get('/admin', (req, res) => {
  res.render('admin/admin');
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log('Server listening on port 3000');
});
