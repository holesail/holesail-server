// start-servers.js

const HolesailServer = require('./index.js'); // Assuming the server module is in a file named index.js

const server1 = new HolesailServer();
const server2 = new HolesailServer();

server1.serve(5000, '127.0.0.1', () => {
  console.log('Server 1 started');
  server1.destroy()
});

server2.serve(5100, '127.0.0.1', () => {
  console.log('Server 2 started');
   server2.destroy()
});

