// Importing required modules
const HyperDHT = require('hyperdht')  // HyperDHT module for DHT functionality
const net = require('net')  // Node.js net module for creating network clients and servers
const libNet = require('@hyper-cmd/lib-net')  // Custom network library
const goodbye = require('graceful-goodbye')  // Graceful shutdown library
const libKeys = require('@hyper-cmd/lib-keys') // To generate a random preSeed for server seed.

class holesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
  }

  keyPair () {
    let preSeed = libKeys.randomBytes(32).toString('hex')
    let seed = Buffer.from(preSeed, 'hex')
    //the keypair here is not a reference to the function above
    return HyperDHT.keyPair(seed)
  }

  //start the client on port and the address specified
  serve (port, address, callback) {
    this.server = this.dht.createServer({
      reusableSocket: true
    }, c => {
      // Connection handling using custom connection piper function
      libNet.connPiper(c, () => {
        return net.connect(
          { port: +port, host: address, allowHalfOpen: true }
        )
      }, { isServer: true, compress: false }, this.stats)
    })

    this.server.listen(this.keyPair()).then(() => {
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })
  }

  destroy(){
    this.dht.destroy()
  }

  async shutdown () {
    await this.dht.destroy()
  }

  getPublicKey () {
    return this.keyPair().publicKey.toString('hex')
  }
} //end server Class

module.exports = holesailServer
