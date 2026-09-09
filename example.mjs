import HolesailServer from './index.js'

const opts = {
  host: '127.0.0.1',
  port: 3456,
  udp: true
}

const server = new HolesailServer(opts)
await server.ready()
console.log(server.invite)
