const HyperDHT = require('hyperdht')  // HyperDHT module for DHT functionality
const net = require('net')  // Node.js net module for creating network clients and servers
const libNet = require('@hyper-cmd/lib-net')  // Custom network library
const goodbye = require('graceful-goodbye')  // Graceful shutdown library
const libKeys = require('@hyper-cmd/lib-keys') // To generate a random preSeed for server seed.

// Generate a new preSeed and seed every time the module is required
function generateKeys() {
  const preSeed = libKeys.randomBytes(32).toString('hex')
  const seed = Buffer.from(preSeed, 'hex')
  const keyPair = HyperDHT.keyPair(seed)
  return { preSeed, seed, keyPair }
}

const stats = {}

//start the client on port and the address specified
function serve(port, address) {
  const { preSeed, seed, keyPair } = generateKeys()

  console.log(preSeed);

  const server = dht.createServer({
    reusableSocket: true
  }, c => {
    // Connection handling using custom connection piper function
    connPiper(c, () => {
      return net.connect(
        { port: +port, host: address, allowHalfOpen: true }
      )
    }, { isServer: true, compress: false }, stats)
  })

  server.listen(keyPair).then(() => {
    //do whatever you want after starting to listen
    console.log(keyPair.publicKey.toString('hex'))
  })
}

goodbye(async () => {
  await dht.destroy()
})

//export the function
module.exports.serve = serve;

//export the public key
module.exports.pubKey = keyPair.publicKey.toString('hex');
