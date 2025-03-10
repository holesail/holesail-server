import HolesailServer from './index.js'

const server1 = new HolesailServer()

await server1.start(
  {
    port: 9001,
    host: '0.0.0.0',
    udp: false,
    seed: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
    secure: true,
    route: '/v1/route/is/good'
  },
  async () => {
    console.log('TCP started on 0.0.0.0:9001')
    console.log('Join with key: ', server1.getPublicKey())
  }
)

console.log(server1.info)