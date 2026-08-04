const test = require('brittle')
const b4a = require('b4a')
const HolesailServer = require('../index.js')
const { parse, randomSeed } = require('@holesail/invite')
const { createTestnet, rawSocket, createLogger } = require('./helpers.js')

test('constructor - defaults to a silent noop logger', async (t) => {
  const server = new HolesailServer()
  t.teardown(() => server.close())

  t.execution(() => server.logger.debug('x'))
  t.execution(() => server.logger.info('x'))
  t.execution(() => server.logger.warn('x'))
  t.execution(() => server.logger.error('x'))
  t.is(server.udp, false)
  t.alike(server.bootstrap, [])
})

test('constructor - udp only enabled when opts.udp is strictly true', async (t) => {
  const server = new HolesailServer({ udp: 1 })
  t.teardown(() => server.close())
  t.is(server.udp, false)

  const udpServer = new HolesailServer({ udp: true })
  t.teardown(() => udpServer.close())
  t.is(udpServer.udp, true)
})

test('constructor - custom logger is used instead of the default noop', async (t) => {
  const { logger, calls } = createLogger()
  const server = new HolesailServer({ logger })
  t.teardown(() => server.close())

  await server.ready()

  t.ok(calls.info.length > 0, 'custom logger received info calls during startup')
})

test('ready() - only resolves once the DHT server is actually listening', async (t) => {
  const testnet = await createTestnet(t)
  const seed = randomSeed()

  const server = new HolesailServer({
    port: 1,
    host: '127.0.0.1',
    seed,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())

  await server.ready()

  t.is(server.state, 'listening')
  t.ok(server.server, 'server handle exists')
  t.ok(server.keyPair, 'key pair generated')

  // If ready() resolved before listen() actually completed, connecting to the
  // freshly-started server right away would race and fail with PEER_NOT_FOUND.
  const { publicKey } = server.keyPair
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, publicKey)
  t.ok(socket.publicKey, 'client connected to the server immediately after ready()')
  socket.destroy()
})

test('ready() - emits a listening event exactly once', async (t) => {
  const testnet = await createTestnet(t)
  const server = new HolesailServer({
    port: 1,
    host: '127.0.0.1',
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())

  let count = 0
  server.on('listening', () => count++)

  await server.ready()
  t.is(count, 1)
})

test('seed - deterministic key pair and invite for the same seed', async (t) => {
  const testnet = await createTestnet(t)
  const seed = randomSeed()

  const a = new HolesailServer({ port: 1, host: '127.0.0.1', seed, bootstrap: testnet.bootstrap })
  const b = new HolesailServer({ port: 1, host: '127.0.0.1', seed, bootstrap: testnet.bootstrap })
  t.teardown(() => Promise.all([a.close(), b.close()]))

  await Promise.all([a.ready(), b.ready()])

  t.alike(a.keyPair.publicKey, b.keyPair.publicKey)
  t.alike(a.keyPair.secretKey, b.keyPair.secretKey)
  t.is(a.invite, b.invite)
})

test('seed - random seed produces a different invite each time', async (t) => {
  const testnet = await createTestnet(t)

  const a = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  const b = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  t.teardown(() => Promise.all([a.close(), b.close()]))

  await Promise.all([a.ready(), b.ready()])

  t.not(a.invite, b.invite)
  t.not(b4a.toString(a.keyPair.publicKey, 'hex'), b4a.toString(b.keyPair.publicKey, 'hex'))
})

test('invite - parses back to the same public key the server listens on', async (t) => {
  const testnet = await createTestnet(t)
  const server = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  t.teardown(() => server.close())
  await server.ready()

  t.ok(server.invite.startsWith('hs_'))

  const parsed = parse(server.invite)
  t.alike(b4a.from(parsed.publicKey), b4a.from(server.keyPair.publicKey))
  t.alike(b4a.from(parsed.capability), b4a.from(server.capability))
})

test('info - reflects live server state', async (t) => {
  const testnet = await createTestnet(t)
  const seed = randomSeed()
  const server = new HolesailServer({
    port: 4321,
    host: '127.0.0.1',
    udp: true,
    seed,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())

  await server.ready()
  const info = server.info

  t.is(info.state, 'listening')
  t.is(info.port, 4321)
  t.is(info.host, '127.0.0.1')
  t.is(info.udp, true)
  t.is(info.invite, server.invite)
  t.is(b4a.toString(info.seed, 'hex'), seed)
})

test('pause()/resume() - transitions state and a fresh tunnel still works after resume', async (t) => {
  const testnet = await createTestnet(t)
  const server = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  t.teardown(() => server.close())
  await server.ready()

  await server.pause()
  t.is(server.state, 'paused')

  await server.resume()
  t.is(server.state, 'listening')

  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)
  t.ok(socket.publicKey, 'can still connect after resume')
  socket.destroy()
})

test('close() - tears down dht/server/connection and marks the resource destroyed', async (t) => {
  const testnet = await createTestnet(t)
  const server = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  await server.ready()

  let closed = false
  server.on('close', () => (closed = true))

  await server.close()

  t.is(server.dht, null)
  t.is(server.server, null)
  t.is(server.connection, null)
  t.is(server.state, 'destroyed')
  t.ok(server.closed, 'ReadyResource marks the instance closed')
  t.ok(closed, 'close event emitted')
})

test('close() - safe to call without ever calling ready()', async (t) => {
  const server = new HolesailServer()

  await server.close()

  t.is(server.dht, null)
  t.is(server.server, null)
  t.is(server.state, 'destroyed')
})

test('connection event - fires for every incoming stream, before capability is checked', async (t) => {
  const testnet = await createTestnet(t)
  const server = new HolesailServer({ port: 1, host: '127.0.0.1', bootstrap: testnet.bootstrap })
  t.teardown(() => server.close())
  await server.ready()

  let fired = false
  server.on('connection', () => (fired = true))

  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)
  // no protocol header sent at all - the connection event should still have fired
  await new Promise((resolve) => setTimeout(resolve, 50))

  t.ok(fired)
  socket.destroy()
})
