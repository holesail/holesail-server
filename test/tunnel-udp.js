const test = require('brittle')
const b4a = require('b4a')
const proto = require('@holesail/protocol')
const { parse } = require('@holesail/invite')
const {
  createTestnet,
  startServer,
  udpEchoServer,
  rawSocket,
  readOnce,
  frame,
  unframe
} = require('./helpers.js')

test('tunnels UDP datagrams end-to-end through a real local echo server, length-framed', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await udpEchoServer(t)

  const server = await startServer(t, testnet, { port: echo.address().port, udp: true })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)

  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))
  socket.write(frame(b4a.from('udp-ping')))

  const raw = await readOnce(socket)
  t.is(b4a.toString(unframe(raw)), 'udp-ping')

  socket.destroy()
})

test('carries several distinct UDP datagrams over one tunnel without mixing frames', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await udpEchoServer(t)

  const server = await startServer(t, testnet, { port: echo.address().port, udp: true })

  const { capability } = parse(server.invite)
  const client = testnet.createNode()
  const socket = await rawSocket(t, client, server.keyPair.publicKey)
  socket.write(proto.encodeHeader(b4a.from(capability), proto.MODE_TUNNEL))

  const messages = ['one', 'two', 'three']
  const received = []
  let buffer = b4a.alloc(0)

  const done = new Promise((resolve) => {
    socket.on('data', (chunk) => {
      buffer = b4a.concat([buffer, chunk])
      while (buffer.length >= 4) {
        const len = buffer.readUInt32BE(0)
        if (buffer.length < 4 + len) break
        received.push(b4a.toString(buffer.subarray(4, 4 + len)))
        buffer = buffer.subarray(4 + len)
      }
      if (received.length === messages.length) resolve()
    })
  })

  for (const msg of messages) socket.write(frame(b4a.from(msg)))
  await done

  t.alike(received.sort(), messages.sort())
  socket.destroy()
})

test('info() reports udp true for a udp server and the probe response confirms it', async (t) => {
  const testnet = await createTestnet(t)
  const echo = await udpEchoServer(t)

  const server = await startServer(t, testnet, { port: echo.address().port, udp: true })

  t.is(server.info.udp, true)
})
