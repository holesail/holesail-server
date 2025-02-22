import HolesailServer from './index.js'

const server1 = new HolesailServer()

await server1.serve(
  {
    port: 9001,
    host: '0.0.0.0',
    udp: false,
    seed: 'c8233747d4b1aa259d3cfedd1b20364e35972c8e3af1d39b6041f5cea4f4a9d9',
    secure: true
  },
  async () => {
    console.log('TCP started on 0.0.0.0:9001')
    console.log('Join with key: ', server1.getPublicKey())
  }
)

console.log(server1.info)
