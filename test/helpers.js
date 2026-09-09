const testnet = require('hyperdht/testnet.js')
const net = require('net')
const dgram = require('dgram')
const b4a = require('b4a')
const HolesailServer = require('../index.js')

// Small local DHT swarm bootstrapped off of a single loopback node instead of
// the public network, so tests are fast, deterministic, and offline.
async function createTestnet(t, size = 30) {
  return testnet(size, { teardown: t.teardown })
}

async function startServer(t, testnet, opts = {}) {
  const server = new HolesailServer({
    host: '127.0.0.1',
    bootstrap: testnet.bootstrap,
    ...opts
  })
  t.teardown(() => server.close())
  await server.ready()
  return server
}

function tcpEchoServer(t) {
  return new Promise((resolve, reject) => {
    const server = net.createServer({ allowHalfOpen: true }, (sock) => {
      sock.on('data', (d) => sock.write(d))
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      t.teardown(() => server.close())
      resolve(server)
    })
  })
}

function udpEchoServer(t) {
  return new Promise((resolve, reject) => {
    const server = dgram.createSocket('udp4')
    server.on('message', (msg, rinfo) => {
      server.send(msg, 0, msg.length, rinfo.port, rinfo.address)
    })
    server.on('error', reject)
    server.bind(0, '127.0.0.1', () => {
      t.teardown(() => server.close())
      resolve(server)
    })
  })
}

// Connects a raw DHT socket to the server's public key, bypassing any client
// library so the test exercises exactly the bytes on the wire.
function rawSocket(t, clientNode, publicKey) {
  return new Promise((resolve, reject) => {
    const socket = clientNode.connect(publicKey)
    t.teardown(() => {
      if (!socket.destroyed) socket.destroy()
    })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function readOnce(stream) {
  return new Promise((resolve, reject) => {
    stream.once('data', (d) => resolve(d))
    stream.once('error', reject)
  })
}

function waitForEvent(emitter, event) {
  return new Promise((resolve) => emitter.once(event, (...args) => resolve(args[0])))
}

function createLogger() {
  const calls = { debug: [], info: [], warn: [], error: [] }
  const logger = {
    debug: (...a) => calls.debug.push(a),
    info: (...a) => calls.info.push(a),
    warn: (...a) => calls.warn.push(a),
    error: (...a) => calls.error.push(a)
  }
  return { logger, calls }
}

function frame(payload) {
  const buf = b4a.from(payload)
  const len = b4a.alloc(4)
  len.writeUInt32BE(buf.length, 0)
  return b4a.concat([len, buf])
}

function unframe(buf) {
  const len = buf.readUInt32BE(0)
  return buf.subarray(4, 4 + len)
}

module.exports = {
  createTestnet,
  startServer,
  tcpEchoServer,
  udpEchoServer,
  rawSocket,
  readOnce,
  waitForEvent,
  createLogger,
  frame,
  unframe
}
