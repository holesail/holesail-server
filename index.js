// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const net = require('net') // Node.js net module for creating network clients and servers
const libNet = require('@holesail/hyper-cmd-lib-net') // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.
const b4a = require('b4a')
const z32 = require('z32')
const HolesailLogger = require('holesail-logger')

class HolesailServer {
  constructor (opts = {}) {
    this.logger = opts.logger || new HolesailLogger({ prefix: 'HolesailServer', enabled: false, level: 1 })
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.seed = null
    this.state = null
    this.connection = null
    this.activeConnections = new Map()
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
    this.logger.debug(`Generated key pair from seed: ${seed}`)
    return this.keyPair
  }

  // start the client on port and the address specified
  async start (args, callback) {
    this.logger.log('Starting server')
    await this.dht.ready()
    this.logger.log('DHT bootstrapped and ready')
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
      this.logger.log('Secure mode enabled with private firewall')
    } else {
      this.logger.log('Secure mode disabled')
    }
    this.server = this.dht.createServer(
      {
        firewall: privateFirewall,
        reusableSocket: true
      },
      (c) => {
        const encodedKey = z32.encode(c.remotePublicKey)
        this.logger.debug(`Incoming connection received from ${encodedKey}`)
        const count = this.activeConnections.get(encodedKey) || 0
        this.activeConnections.set(encodedKey, count + 1)
        if (!args.udp) {
          this.handleTCP(c, args)
        } else {
          this.handleUDP(c, args)
        }
      }
    )
    this.logger.debug('Server created, awaiting listen')
    // start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      this.state = 'listening'
      this.logger.log(`Server listening on key: ${this.key}`)
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })

    const interval = 50 * 60 * 1000
    // put host information on the dht
    const data = JSON.stringify({
      host: this.args.host,
      udp: this.args.udp,
      port: this.args.port
    })
    this.logger.debug(`Initializing DHT with host info: ${data}`)
    await this.put(data)
    setInterval(async () => {
      this.logger.debug(`Refreshing DHT record: ${data}`)
      await this.put(data)
    }, interval)
  }

  // Handle TCP connections
  handleTCP (c, args) {
    this.logger.debug('Handling TCP connection')
    const encodedKey = z32.encode(c.remotePublicKey)
    c.on('close', () => {
      let count = this.activeConnections.get(encodedKey) || 1
      count--
      if (count <= 0) {
        this.logger.debug(`Disconnected from ${encodedKey}`)
        this.activeConnections.delete(encodedKey)
      } else {
        this.activeConnections.set(encodedKey, count)
      }
    })
    // Connection handling using custom connection piper function
    this.connection = libNet.connPiper(
      c,
      () => {
        this.logger.debug(`Connecting to local TCP: ${args.host}:${args.port}`)
        return net.connect({
          port: +args.port,
          host: args.host,
          allowHalfOpen: true
        })
      },
      { isServer: true, compress: false, logger: this.logger },
      this.stats
    )
    this.logger.debug('TCP connection piped')
  }

  // Handle UDP connections
  handleUDP (c, args) {
    this.logger.debug('Handling UDP connection')
    const encodedKey = z32.encode(c.remotePublicKey)
    c.on('close', () => {
      let count = this.activeConnections.get(encodedKey) || 1
      count--
      if (count <= 0) {
        this.logger.debug(`Disconnected from ${encodedKey}`)
        this.activeConnections.delete(encodedKey)
      } else {
        this.activeConnections.set(encodedKey, count)
      }
    })
    this.connection = libNet.udpPiper(
      c,
      () => {
        this.logger.debug(`Connecting to local UDP: ${args.host}:${args.port}`)
        return libNet.udpConnect({
          port: +args.port,
          host: args.host
        })
      },
      { isServer: true, compress: false, logger: this.logger },
      this.stats
    )
    this.logger.debug('UDP connection piped')
  }

  // Return the public/connection key
  get key () {
    if (this.secure) {
      return z32.encode(this.seed)
    } else {
      return z32.encode(this.keyPair.publicKey)
    }
  }

  // resume functionality
  async resume () {
    this.logger.log('Resuming server')
    await this.dht.resume()
    this.state = 'listening'
    this.logger.log('Server resumed')
  }

  async pause () {
    this.logger.log('Pausing server')
    await this.dht.suspend()
    this.state = 'paused'
    this.logger.log('Server paused')
  }

  // destroy the dht instance and free up resources
  async destroy () {
    this.logger.log('Destroying server')
    if (this.dht) await this.dht.destroy()
    this.dht = null
    if (this.server) this.server = null
    if (this.connection) this.connection = null
    this.state = 'destroyed'
    this.logger.log('Server destroyed')
  }

  // put a mutable record on the dht, can be retrieved by any client using the keypair, max limit is 1KB
  async put (data, opts = {}) {
    this.logger.debug(`Putting DHT record: ${data}`)
    data = b4a.isBuffer(data) ? data : Buffer.from(data)
    if (opts.seq) {
      await this.dht.mutablePut(this.keyPair, data, opts)
      this.logger.debug(`DHT put completed with seq: ${opts.seq}`)
      return opts.seq
    }
    this.logger.debug('Checking for existing DHT record')
    const oldRecord = await this.get({ latest: true })
    if (!oldRecord) {
      this.logger.debug('No existing DHT record found, creating new')
      const { seq } = await this.dht.mutablePut(this.keyPair, data, opts)
      this.logger.debug(`DHT put (new) completed with seq: ${seq}`)
      return seq
    } else if (b4a.toString(oldRecord.value) === b4a.toString(data)) {
      this.logger.debug(`DHT put skipped (unchanged), seq: ${oldRecord.seq}`)
      return oldRecord.seq
    } else {
      this.logger.debug('Existing DHT record found, updating')
      opts.seq = oldRecord.seq + 1
      await this.dht.mutablePut(this.keyPair, data, opts)
      this.logger.debug(`DHT put (updated) completed with seq: ${opts.seq}`)
      return opts.seq
    }
  }

  // get mutable record from dht
  async get (opts = {}) {
    const record = await this.dht.mutableGet(this.keyPair.publicKey, opts)
    if (record) {
      const value = b4a.toString(record.value)
      this.logger.debug(`Existing DHT record found: seq=${record.seq}, value=${value}`)
      return { seq: record.seq, value }
    }
    return null
  }

  // return information about the server
  get info () {
    return {
      type: 'server',
      state: this.state,
      secure: this.secure,
      port: this.args.port,
      host: this.args.host,
      protocol: this.args.udp ? 'udp' : 'tcp',
      seed: this.args.seed,
      key: this.key,
      publicKey: z32.encode(this.keyPair.publicKey)
    }
  }
}

module.exports = HolesailServer
