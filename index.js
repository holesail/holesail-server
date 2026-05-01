// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const libNet = require('/Volumes/superdisk/Developer/hyper-cmd-lib-net') // Custom network library
const b4a = require('b4a')
const z32 = require('z32')
const Protomux = require('protomux')
const ReadyResource = require('ready-resource')
const c = require('compact-encoding')
const { generate } = require('/Volumes/superdisk/Developer/verify/index.js')

class HolesailServer extends ReadyResource {
  constructor(opts = {}) {
    super()
    this.logger = opts.logger || {
      debug: () => {},
      info: (data) => console.log(data),
      warn: () => {},
      error: () => {}
    }
    this.udp = opts.udp === true
    this.host = opts.host
    this.port = opts.port
    this.seed = opts.seed

    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.state = null
    this.connection = null
    this.activeConnections = new Map()
  }

  async _open() {
    const { seed, keyPair, capability, invite } = generate(this.seed)
    this.seed = seed
    this.keyPair = keyPair
    this.capability = capability
    this._invite = invite
    await this._start()
  }

  // start the client on port and the address specified
  async _start() {
    this.logger.info('Starting server')

    this.server = this.dht.createServer(
      {
        reusableSocket: true
      },
      (stream) => {
        this.logger.debug('Received stream from remote')
        const mux = new Protomux(stream)

        const auth = mux.createChannel({
          protocol: 'holesail-auth',
          onopen: () => {
            this.logger.debug('Client opened auth protocol')
          },
          messages: [
            {
              encoding: c.any,
              onmessage: (m) => {
                const encodedKey = z32.encode(stream.remotePublicKey)
                this.logger.info(`Incoming connection received from ${encodedKey}`)

                if (!b4a.equals(m.capability, this.capability)) {
                  this.logger.warn('Client verification failed')
                  // TODO: destroy stream here
                } else {
                  this.logger.info('Client verified succesfuly')
                  const count = this.activeConnections.get(encodedKey) || 0
                  this.activeConnections.set(encodedKey, count + 1)
                  if (!this.udp) {
                    this._handleTCP(stream)
                  } else {
                    this._handleUDP(stream)
                  }
                }
              }
            }
          ]
        })
        auth.open()

        const probe = mux.createChannel({
          protocol: 'holesail-probe',
          onopen: () => {
            this.logger.debug('Client opened probe protocol')
          },
          messages: [
            {
              encoding: c.any,
              onmessage: (m) => {
                const encodedKey = z32.encode(stream.remotePublicKey)
                this.logger.info(`Incoming probe received from ${encodedKey}`)

                if (!b4a.equals(m.capability, this.capability)) {
                  this.logger.warn('Client verification failed')
                  // TODO: destroy stream here
                } else {
                  this.logger.info('Client verified succesful')
                  probe.messages[0].send({ port: this.port, host: this.host, udp: this.udp })
                }
              }
            }
          ]
        })
        probe.open()
      }
    )
    this.logger.debug('Authentication protocol setup, listening on keypair')
    // start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      this.state = 'listening'
      this.logger.info(`Server started, invite: ${this.invite}`)
    })
  }

  // Handle TCP connections
  _handleTCP(stream) {
    this.logger.debug('Handling TCP connection')
    const encodedKey = z32.encode(stream.remotePublicKey)
    stream.on('close', () => {
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
    this.connection = libNet.pipeTcpServer(
      stream,
      { port: this.port, host: this.host },
      { isServer: true, logger: this.logger },
      this.stats
    )
    this.logger.debug('TCP connection piped')
  }

  // Handle UDP connections (updated to use framed reliable tunneling)
  _handleUDP(stream) {
    this.logger.debug('Handling UDP connection')
    const encodedKey = z32.encode(stream.remotePublicKey)
    stream.on('close', () => {
      let count = this.activeConnections.get(encodedKey) || 1
      count--
      if (count <= 0) {
        this.logger.debug(`Disconnected from ${encodedKey}`)
        this.activeConnections.delete(encodedKey)
      } else {
        this.activeConnections.set(encodedKey, count)
      }
    })
    this.connection = libNet.pipeUdpFramedServer(
      stream,
      { port: this.port, host: this.host },
      this.logger,
      this.stats
    )
    this.logger.debug('UDP connection framed and piped')
  }

  // Return the public/connection key
  // done
  get invite() {
    return this._invite
  }

  // resume functionality
  // done
  async resume() {
    this.logger.info('Resuming server')
    await this.dht.resume()
    this.state = 'listening'
    this.logger.info('Server resumed')
  }

  // done
  async pause() {
    this.logger.info('Pausing server')
    await this.dht.suspend()
    this.state = 'paused'
    this.logger.info('Server paused')
  }

  // return information about the server
  get info() {
    return {
      type: 'server',
      state: this.state,
      port: this.port,
      host: this.host,
      protocol: this.udp ? 'udp' : 'tcp',
      seed: this.seed,
      invite: this.invite
    }
  }

  async _close() {
    this.logger.info('Closing Holesail server')
    if (this.dht) await this.dht.destroy()
    this.dht = null
    if (this.server) this.server = null
    if (this.connection) this.connection = null
    this.state = 'destroyed'
    this.logger.info('Server destroyed')
  }
}

module.exports = HolesailServer
