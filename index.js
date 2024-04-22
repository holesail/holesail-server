// Importing required modules
const HyperDHT = require('hyperdht')  // HyperDHT module for DHT functionality
const net = require('net')  // Node.js net module for creating network clients and servers
const libNet = require('hyper-cmd-lib-net')  // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.

class holesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.key = null
    this.preSeed = null
  }

  keyPair (buffSeed) {
    if (buffSeed) {
      this.preSeed = buffSeed
    } else {
      this.preSeed = libKeys.randomBytes(32).toString('hex')
    }

    const seed = Buffer.from(this.preSeed, 'hex')
    //the keypair here is not a reference to the function above
    const key = HyperDHT.keyPair(seed)
    this.key = key
    return key
  }

  //start the client on port and the address specified
  serve (args,callback) {
    this.server = this.dht.createServer({
      reusableSocket: true
    }, c => {
      // Connection handling using custom connection piper function
      libNet.connPiper(c, () => {
        return net.connect(
          { port: +args.port, host: args.address, allowHalfOpen: true }
        )
      }, { isServer: true, compress: false }, this.stats)
    })

    this.server.listen(this.keyPair(args.buffSeed)).then(() => {
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })
  }

  destroy () {
    this.dht.destroy()
    this.server.close()
    return 0;
  }

  getPublicKey () {
    return this.key.publicKey.toString('hex')
  }
} //end server Class

module.exports = holesailServer
