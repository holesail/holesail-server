const HyperDHT = require('hyperdht')
const libNet = require('@holesail/hyper-cmd-lib-net')
const b4a = require('b4a')
const z32 = require('z32')
const ReadyResource = require('ready-resource')
const { generate } = require('@holesail/invite')
const proto = require('@holesail/protocol')

const { MODE_TUNNEL, MODE_PROBE } = proto

class HolesailServer extends ReadyResource {
  constructor(opts = {}) {
    super()
    this.logger = opts.logger || {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    }
    this.udp = opts.udp === true
    this.host = opts.host
    this.port = opts.port
    this.seed = opts.seed
    this.bootstrap = opts.bootstrap || {}

    this.dht = null
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
    this.dht = new HyperDHT({ bootstrap: this.bootstrap })
    await this._start()
  }

  async _start() {
    this.logger.info('Starting server')

    this.server = this.dht.createServer({ reusableSocket: true }, (stream) => {
      this.emit('connection')
      this._onConnection(stream)
    })

    this.server.listen(this.keyPair).then(() => {
      this.state = 'listening'
      this.logger.info(`Server started, invite: ${this.invite}`)
      this.emit('listening')
    })
  }

  _onConnection(stream) {
    stream.on('error', (err) => {
      this.logger.debug(`Stream error: ${err && err.message}`)
    })

    let buffer = b4a.alloc(0)
    const onData = (chunk) => {
      buffer = b4a.concat([buffer, chunk])
      const decoded = proto.decodeHeader(buffer)
      if (!decoded) return

      stream.removeListener('data', onData)

      const { capability, mode, leftover } = decoded
      const encodedKey = z32.encode(stream.remotePublicKey)

      if (!b4a.equals(capability, this.capability)) {
        this.logger.warn(`Verification failed for ${encodedKey}`)
        stream.destroy()
        return
      }

      if (mode === MODE_PROBE) {
        this.logger.info(`Probe from ${encodedKey}`)
        this._handleProbe(stream)
        return
      }

      if (mode === MODE_TUNNEL) {
        this.logger.info(`Tunnel from ${encodedKey}`)
        const count = this.activeConnections.get(encodedKey) || 0
        this.activeConnections.set(encodedKey, count + 1)
        if (this.udp) this._handleUDP(stream, leftover)
        else this._handleTCP(stream, leftover)
        return
      }

      this.logger.warn(`Unknown mode ${mode} from ${encodedKey}`)
      stream.destroy()
    }
    stream.on('data', onData)
  }

  _handleProbe(stream) {
    stream.end(proto.encodeProbeResponse({ port: this.port, host: this.host, udp: this.udp }))
  }

  _handleTCP(stream, leftover) {
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
    const opts = { port: this.port, host: this.host, logger: this.logger }
    this.connection = libNet.pipeTcpServer(stream, leftover, opts)
  }

  _handleUDP(stream, leftover) {
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
    const opts = { port: this.port, host: this.host, logger: this.logger }
    this.connection = libNet.pipeUdpFramedServer(stream, leftover, opts)
  }

  get invite() {
    return this._invite
  }

  async resume() {
    this.logger.info('Resuming server')
    await this.dht.resume()
    this.state = 'listening'
    this.logger.info('Server resumed')
  }

  async pause() {
    this.logger.info('Pausing server')
    await this.dht.suspend()
    this.state = 'paused'
    this.logger.info('Server paused')
  }

  get info() {
    return {
      state: this.state,
      port: this.port,
      host: this.host,
      udp: this.udp,
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
    this.emit('close')
  }
}

module.exports = HolesailServer
