const test = require('brittle')
const b4a = require('b4a')
const proto = require('@holesail/protocol')
const { parse } = require('@holesail/invite')
const {
  createTestnet,
  startServer,
  tcpEchoServer,
  rawSocket,
  readOnce,
  waitForEvent
} = require('./helpers.js')

test('tunnels TCP data end-to-end through a real local echo server', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))
  socket.write('ping-through-tunnel')

  const reply = await readOnce(socket)
  t.is(b4a.toString(reply), 'ping-through-tunnel')

  socket.destroy()
})

test('tunnels several sequential writes without corrupting bytes', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)
  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))

  const chunks = ['alpha', 'beta', 'gamma']
  const received = []
  const done = new Promise((resolve) => {
    socket.on('data', (d) => {
      received.push(b4a.toString(d))
      if (received.join('') === chunks.join('')) resolve()
    })
  })

  for (const chunk of chunks) socket.write(chunk)
  await done

  t.is(received.join(''), chunks.join(''))
  socket.destroy()
})

test('emits connection and increments activeConnections while a tunnel is open, then cleans up on close', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const connectionEvent = waitForEvent(server, 'connection')
  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))
  await connectionEvent

  socket.write('hello')
  await readOnce(socket)

  t.is(server.activeConnections.size, 1)
  const [count] = [...server.activeConnections.values()]
  t.is(count, 1)

  socket.destroy()
  await new Promise((resolve) => setTimeout(resolve, 100))

  t.is(server.activeConnections.size, 0)
})

test('two tunnel connections from the same client key are counted independently', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()

  const socketA = await rawSocket(t, client, server.keyPair.publicKey)
  socketA.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))
  socketA.write('a')
  await readOnce(socketA)

  const socketB = await rawSocket(t, client, server.keyPair.publicKey)
  socketB.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))
  socketB.write('b')
  await readOnce(socketB)

  t.is(server.activeConnections.size, 1, 'same z32-encoded client key for both streams')
  t.is([...server.activeConnections.values()][0], 2)

  socketA.destroy()
  await new Promise((resolve) => setTimeout(resolve, 100))
  t.is([...server.activeConnections.values()][0], 1)

  socketB.destroy()
  await new Promise((resolve) => setTimeout(resolve, 100))
  t.is(server.activeConnections.size, 0)
})

test('rejects a tunnel request with the wrong capability and never dials the local target', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  let dialed = false
  echo.on('connection', () => (dialed = true))
  const server = await startServer(t, testnet, { port: echo.address().port })

  const wrongCapability = b4a.alloc(32, 0x42)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const closed = waitForEvent(socket, 'close')
  socket.write(proto.encodeHeader(wrongCapability, proto.MODE_TUNNEL))

  await closed
  t.ok(socket.destroyed)
  t.absent(dialed, 'local echo server never saw a connection for a rejected capability')
  t.is(server.activeConnections.size, 0)
})

test('destroys the stream when the protocol mode is unrecognized', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const UNKNOWN_MODE = 99
  const closed = waitForEvent(socket, 'close')
  socket.write(proto.encodeHeader(b4a.from(capability), UNKNOWN_MODE))

  await closed
  t.ok(socket.destroyed)
})

test('tunneled connection survives the protocol header arriving split across multiple packets', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const header = proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL)
  socket.write(header.subarray(0, 10))
  await new Promise((resolve) => setTimeout(resolve, 20))
  socket.write(header.subarray(10))
  socket.write('after-split-header')

  const reply = await readOnce(socket)
  t.is(b4a.toString(reply), 'after-split-header')

  socket.destroy()
})

test('leftover bytes sent together with the header are forwarded to the local target', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await tcpEchoServer(t)
  const server = await startServer(t, testnet, { port: echo.address().port })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  const header = proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL)
  const payload = b4a.from('leftover-in-same-write')
  socket.write(b4a.concat([header, payload]))

  const reply = await readOnce(socket)
  t.is(b4a.toString(reply), 'leftover-in-same-write')

  socket.destroy()
})
