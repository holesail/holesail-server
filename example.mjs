import HolesailServer from './index.js'

const opts = {
  host: '127.0.0.1',
  port: 3456,
  seed: '66e877e724f2b976ccfce96cd31fb7ccede58239137f4591cb4ccf1c972cb8f8',
  udp: true
}

const server = new HolesailServer(opts)
await server.ready()
console.log(server.info)
