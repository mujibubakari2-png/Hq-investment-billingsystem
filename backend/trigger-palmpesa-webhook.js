const http = require('http');

const data = JSON.stringify({
  TransactionId: "SIM" + Date.now(),
  AccountReference: "INV-2026-YOUR_INVOICE_ID", // Change this to the actual PENDING invoice number from the database!
  Amount: 20000,
  ResultCode: "0",
  ResultDesc: "The service request is processed successfully."
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/payments/palmpesa/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
