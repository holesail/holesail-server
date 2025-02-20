// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const net = require('net') // Node.js net module for creating network clients and servers

const libNet = require('@holesail/hyper-cmd-lib-net') // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.
const b4a = require('b4a')

class HolesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.seed = null
    this.connection = null
    this.state = null
  }

  generateKeyPair (seed) {
    // Allows us to keep the same keyPair everytime.
    if (!seed) {
      seed = libKeys.randomBytes(32).toString('hex')
    }
    // generate a seed from the buffer key
    this.seed = Buffer.from(seed, 'hex')
    // generate a keypair from the seed
    this.keyPair = HyperDHT.keyPair(this.seed)
    return this.keyPair
  }

  // start the client on port and the address specified
  serve (args, callback) {
    this.args = args
    this.secure = args.secure === true

    // generate the keypair
    this.generateKeyPair(args.seed)
    // this is needed for the secure mode to work and is implemented by HyperDHT
    let privateFirewall = false
    if (this.secure) {
      privateFirewall = (remotePublicKey) => {
        return !b4a.equals(remotePublicKey, this.keyPair.publicKey)
      }
    }

    this.server = this.dht.createServer(
      {
        firewall: privateFirewall,
        reusableSocket: true
      },
      (c) => {
        if (!args.udp) {
          this.handleTCP(c, args)
        } else {
          this.handleUDP(c, args)
        }
      }
    )

    // start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
      this.state = 'listening'
    })
  }

  // Handle  TCP connections
  handleTCP (c, args) {
    // Connection handling using custom connection piper function
    this.connection = libNet.connPiper(
      c,
      () => {
        return net.connect({
          port: +args.port,
          host: args.address,
          allowHalfOpen: true
        })
      },
      { isServer: true, compress: false },
      this.stats
    )
  }

  // Handle UDP connections
  handleUDP (c, args) {
    this.connection = libNet.udpPiper(
      c,
      () => {
        return libNet.udpConnect({
          port: +args.port,
          host: args.address
        })
      },
      { isServer: true, compress: false },
      this.stats
    )
  }

  // Return the public/connection key
  getPublicKey () {
    if (this.secure) {
      return b4a.toString(this.seed, 'hex')
    } else {
      return this.keyPair.publicKey.toString('hex')
    }
  }

  // resume functionality
  async resume () {
    await this.dht.resume()
    this.state = 'listening'
  }

  async pause () {
    await this.dht.suspend()
    this.state = 'paused'
  }

  // destroy the dht instance and free up resources
  async destroy () {
    await this.dht.destroy()
    this.dht = null
    this.server = null
    this.connection = null
    this.state = 'destroyed'
  }

  get info () {
    return {
      state: this.state,
      secure: this.secure,
      port: this.args.port,
      host: this.args.host,
      protocol: this.args.udp ? 'udp' : 'tcp',
      seed: this.args.seed,
      publicKey: this.getPublicKey()
    }
  }
}

module.exports = HolesailServer
