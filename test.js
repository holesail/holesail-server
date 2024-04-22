// start-servers.js

const HolesailServer = require('./index.js'); // Assuming the server module is in a file named index.js

const server1 = new HolesailServer();
const server2 = new HolesailServer();


server1.serve({port:5000, address:"127.0.0.1",buffSeed:"4917816487c1822049939ff1abbf515663275105d01361bbc84fe2000e594539"}, () => {
    console.log('Server 1 started');
    console.log(server1.getPublicKey());
    setTimeout(() => {
      server1.destroy();
      console.log('Server 1 destroyed');
  }, 6000);

})
// server2.serve(5100, '127.0.0.1', () => {
//   console.log('Server 2 started');
//   console.log(server2.getPublicKey())
//   // server2.destroy()
// });

