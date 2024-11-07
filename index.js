// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const net = require('net') // Node.js net module for creating network clients and servers

const UDX = require('udx-native') // required for UDP
const udp = new UDX()

const libNet = require('@holesail/hyper-cmd-lib-net') // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.
const b4a = require('b4a')

class holesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.buffer = null
    this.seed = null
    this.connection = null
  }

  keyPairGenerator (buffer) {
    // Used to generate a seed
    // if buffer key is provided by the user, allows to keep the same keyPair everytime.
    if (buffer) {
      this.buffer = buffer
    } else {
      this.buffer = libKeys.randomBytes(32).toString('hex')
    }

    // generate a seed from the buffer key
    this.seed = Buffer.from(this.buffer, 'hex')
    // generate a keypair from the seed
    this.keyPair = HyperDHT.keyPair(this.seed)
    return this.keyPair
  }

  // start the client on port and the address specified
  serve (args, callback) {
    this.secure = args.secure === true

    // generate the keypair
    this.keyPairGenerator(args.buffSeed)
    // this is needed for the secure mode to work and is implemented by HyperDHT
    if (this.secure) {
      var privateFirewall = (remotePublicKey) => {
        return !b4a.equals(remotePublicKey, this.keyPair.publicKey)
      }
    } else {
      var privateFirewall = false
    }

    if (!args.udp) {
      this.handleTCP(args, privateFirewall)
    } else {
      this.handleUDP(args, privateFirewall)
    }

    // start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })
  }

  // Handle  TCP connections
  handleTCP (args, privateFirewall) {
    this.server = this.dht.createServer(
      {
        privateFirewall,
        reusableSocket: true
      },
      (c) => {
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
    )
  }

  // Handle UDP connections
  handleUDP (args, privateFirewall) {
    // Create DHT server
    this.server = this.dht.createServer({
      privateFirewall,
      reusableSocket: true
    })
    this.udpListner = udp.createSocket('udp4')
    this.udpListner.bind(args.port, args.address)

    // Executed when a connection is received
    this.server.on('connection', (conn) => {
      // Handle errors
      conn.on('error', (error) => {
        console.log('Error: ', error)
      })

      // Receive data from UDP listner
      this.udpListner.on('message', (buf) => {
        // conn object is received from the remote
        // relay the UDP message to the DHT
        conn.send(Buffer.from(buf))
      })
    })

    // Handle errors
    this.server.on('error', (error) => {
      console.log('Error: ', error)
    })

    // Not handling replies in this scenario
    // We are only relaying UDP to DHT, not sending/expecting a reply
  }

  // destroy the dht instance
  // TODO: Fix issue with server not destroying but only DHT connection after destroy() is called.
  destroy () {
    this.dht.destroy()
    return 0
  }

  // Return the public/connection key
  getPublicKey () {
    if (this.secure) {
      return b4a.toString(this.seed, 'hex')
    } else {
      return this.keyPair.publicKey.toString('hex')
    }
  }
} // end server Class

module.exports = holesailServer
