const { parseStringPromise } = require('xml2js');

// Export a function to parse XML data
exports.parseXml = async function(xmlData) {
  try {
    // Wrap xmlData in a root tag
    const wrappedXmlData = `<root>${xmlData}</root>`;
    const result = await parseStringPromise(wrappedXmlData);
    return result;
  } catch (error) {
    console.error('Error occurred while parsing XML:', error);
    throw error;
  }
};

// Export a function to extract desired information from parsed XML data
exports.extractInformation = function(parsedXmlData) {
  const extractedInfo = [];

  // Handle the BarcodeData structure
  if(parsedXmlData.root.BarcodeData) {
    // Make sure BarcodeData is an array
    const barcodeData = Array.isArray(parsedXmlData.root.BarcodeData) ? parsedXmlData.root.BarcodeData : [parsedXmlData.root.BarcodeData];

    // Map BarcodeData to extracted objects
    barcodeData.forEach(barcode => {
      const value = barcode.Barcode[0] || '';

      extractedInfo.push({
        type: 'barcode',
        value: value,
      });
    });
  }

  // Handle the annotation structure
  if(parsedXmlData.root.annotation) {
    // Make sure annotation is an array
    const annotations = Array.isArray(parsedXmlData.root.annotation) ? parsedXmlData.root.annotation : [parsedXmlData.root.annotation];

    // Map annotations to extracted objects
    annotations.forEach(annotation => {
      const ts = annotation?.$?.ts || '';
      const displaytime = annotation?.$?.displaytime || '';
      const displaytimemilitary = annotation?.$?.displaytimemilitary || '';
      const displaydate = annotation?.$?.displaydate || '';
      const user = annotation?.$?.user || '';
      const labeltitle = annotation?.$?.labeltitle || '';
      const labeldata = annotation?.$?.labeldata || '';
      const index = annotation?.$?.index || '';
      const location = annotation?.$?.location || '';
      const value = annotation?._ || '';

      extractedInfo.push({
        type: 'annotation',
        ts: ts,
        displaytime: displaytime,
        displaytimemilitary: displaytimemilitary,
        displaydate: displaydate,
        user: user,
        labeltitle: labeltitle,
        labeldata: labeldata,
        index: index,
        location: location,
        value: value,
      });
    });
  }

  return extractedInfo;
};
