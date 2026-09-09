const test = require('brittle')
const b4a = require('b4a')
const proto = require('@holesail/protocol')
const { parse } = require('@holesail/invite')
const HolesailServer = require('../index.js')
const {
  createTestnet,
  tcpEchoServer,
  udpEchoServer,
  rawSocket,
  readOnce,
  waitForEvent
} = require('./helpers.js')

test('probe mode returns the real port/host/udp info without opening a tunnel', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  let dialed = false
  echo.on('connection', () => (dialed = true))

  const server = new HolesailServer({
    host: '127.0.0.1',
    port: echo.address().port,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())
  await server.ready()

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_PROBE))

  const raw = await readOnce(socket)
  const probeInfo = proto.decodeProbeResponse(raw)

  t.is(probeInfo.port, echo.address().port)
  t.is(probeInfo.host, '127.0.0.1')
  t.is(probeInfo.udp, false)
  t.absent(dialed, 'probing never dials the local target')
  t.is(server.activeConnections.size, 0)
})

test('probe mode reports udp:true for a udp server', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await udpEchoServer(t)

  const server = new HolesailServer({
    host: '127.0.0.1',
    port: echo.address().port,
    udp: true,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())
  await server.ready()

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_PROBE))

  const raw = await readOnce(socket)
  const probeInfo = proto.decodeProbeResponse(raw)

  t.is(probeInfo.udp, true)
})

test('probe mode ends the stream after responding', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)

  const server = new HolesailServer({
    host: '127.0.0.1',
    port: echo.address().port,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())
  await server.ready()

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const ended = waitForEvent(socket, 'end')
  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_PROBE))
  socket.resume()

  await ended
  t.pass('client observed the server ending the stream after the probe response')
  socket.end()
})

test('probe mode still enforces the capability check', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)

  const server = new HolesailServer({
    host: '127.0.0.1',
    port: echo.address().port,
    bootstrap: testnet.bootstrap
  })
  t.teardown(() => server.close())
  await server.ready()

  const wrongCapability = b4a.alloc(32, 0x99)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const closed = waitForEvent(socket, 'close')
  socket.write(proto.encodeHeader(wrongCapability, proto.MODE_PROBE))

  await closed
  t.ok(socket.destroyed)
})
