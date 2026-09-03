const selfsigned = require("selfsigned");
const fs = require("fs");
const path = require("path");

async function generateCerts() {
  const certDir = path.join(__dirname, "../certificates");
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const attrs = [{ name: "commonName", value: "VMIC Local Server" }];

  const options = {
    days: 365,
    altNames: [
      { type: 2, value: "localhost" },
      { type: 7, ip: "127.0.0.1" },
      { type: 7, ip: "192.168.137.1" },
      { type: 7, ip: "10.110.120.201" },
      { type: 7, ip: "0.0.0.0" },
    ],
  };

  console.log("Generating VMIC self-signed SSL certificates...");
  const pkey = await selfsigned.generate(attrs, options);

  fs.writeFileSync(path.join(certDir, "server.key"), pkey.private);
  fs.writeFileSync(path.join(certDir, "server.crt"), pkey.cert);

  console.log("SSL Certificates generated successfully in frontend/certificates/");
}

generateCerts().catch(console.error);
