# Holesail Server

Node.js and Bare server for exposing a local TCP/UDP service over HyperDHT - P2P reverse proxying, no signalling server required.

```
npm install holesail-server
```

## Usage

```js
const HolesailServer = require('holesail-server')

const server = new HolesailServer({
  port: 8080,
  host: '127.0.0.1'
})

await server.ready()

console.log(server.invite) // share this - anyone holding it can connect a client
```

A [holesail-client](https://github.com/holesail/holesail-client) given this invite can reach `127.0.0.1:8080` on this machine from anywhere.

### Fixed connection key

By default the server generates a random keypair (and invite) on every `ready()`. Pass a `seed` to get the same one every time:

```js
const server = new HolesailServer({
  port: 8080,
  host: '127.0.0.1',
  seed: 'a1b2c3...' // 64 hex chars (32 bytes)
})
```

Use `require('@holesail/invite').randomSeed()` to generate one.

### UDP

```js
const server = new HolesailServer({ port: 53, host: '127.0.0.1', udp: true })
```

### Closing

```js
await server.close()
```

### Pausing and resuming

```js
await server.pause() // stop accepting new connections, keep existing tunnels alive
await server.resume()
```

## API

#### `const server = new HolesailServer(opts)`

Creates a server. Nothing is listening until `ready()` is called.

```js
{
  port: 8080,            // required - local port to forward tunneled connections to
  host: '127.0.0.1',     // required - local host to forward tunneled connections to
  udp: false,            // true to tunnel UDP instead of TCP. Defaults to false
  seed: '<hex string>',  // optional 64-char hex string for a deterministic keypair/invite
  bootstrap: [],         // optional custom HyperDHT bootstrap nodes
  logger: undefined      // optional {debug, info, warn, error} logger
}
```

#### `await server.ready()`

Generates a keypair (from `seed` if given, otherwise random) and starts listening on the DHT. Resolves once `server.invite` is ready to share.

#### `server.invite`

The invite string clients need to connect. Encodes the server's public key and a capability token, a raw DHT connection alone isn't enough to open a tunnel, the client must present the matching capability.

#### `server.on('listening')`

Emitted once the server is listening and `server.invite` is available.

#### `server.on('connection')`

Emitted for every incoming stream, before the capability check runs - useful for connection-rate logging or metrics. Firing doesn't mean the connection presented a valid capability; invalid streams are destroyed right after.

#### `server.info`

```js
{
  state: 'listening', // 'starting' | 'listening' | 'paused' | 'destroyed'
  port: 8080,
  host: '127.0.0.1',
  udp: false,
  seed: '<hex string>',
  invite: '<string>'
}
```

#### `await server.pause()`

Suspends the underlying DHT node without tearing anything down.

#### `await server.resume()`

Resumes a paused server.

#### `await server.close()`

Destroys the DHT node and all open tunnels.

## License

This project is licensed under the GNU AGPL v3 license - see the [LICENSE](LICENSE) and [NOTICE](NOTICE) files.

---

## Community and Support

Join our [Discord Support Server](https://discord.gg/TQVacE7Vnj) for help, discussions, and updates.
