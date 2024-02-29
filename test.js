const DHT = require('./index.js');  // Assuming the DHTServer class is in a file named DHTServer.js

// Create an instance of the DHTServer
const server =  new DHT();
const server2 = new DHT()

// Start the DHT server
server.serve(5000, '127.0.0.1');
server2.serve(5100, '127.0.0.1');

// Get the public key of the server
console.log('Server public key:', server.getPublicKey());

console.log('Server public key:', server2.getPublicKey());
// Graceful shutdown
process.on('SIGINT', async () => {
  await server.shutdown();
  process.exit(0);
});
