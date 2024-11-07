const HolesailServer = require('./index.js') // Assuming the server module is in a file named index.js

const server1 = new HolesailServer()
// const server2 = new HolesailServer()

server1.serve({ port: 9000, address: '127.0.0.1', buffSeed: 'd8afd2605893ba587ffdc60044aa51ede164dbb71219d807ef55d624d8d09241', udp: false }, () => {
  console.log('TCP  started on 127.0.0.1:8000 ')
  console.log(server1.getPublicKey())
  setTimeout(() => {
    server1.destroy()
    console.log('Server 1 destroyed')
  }, 6000)
})

// server2.serve(
//   {
//     port: 45000,
//     address: '0.0.0.0',
//     udp: true,
//     buffSeed:
//       '2656e7cbe15a7acb64b4158b76ea76eaa2715e05e14d76cd4f3da333cb361750'
//   },
//   () => {
//     console.log('UDP server started')
//     console.log('Running on 0.0.0.0:45000')
//     console.log(server2.getPublicKey())
//   }
// )
