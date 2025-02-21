
# Holesail Server

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Holesail Server enables you to reverse proxy servers peer-to-peer (P2P) using HyperDHT.

----------

## Installation

Install the Holesail Server module via npm:

```bash
npm install holesail-server
```

----------

## Usage

### Importing the Module

Require the module in your project:

```javascript
const HolesailServer = require('holesail-server');
```

### Creating an Instance

Create a new instance of the `HolesailServer` class:

```javascript
const server = new HolesailServer();
```

### Starting the Server

Start the server using the `serve` method and retrieve its public key:

```javascript
server.serve({ port: 5000, host: "127.0.0.1" }, () => {
    console.log("Server started");
    console.log(server.getPublicKey());

    setTimeout(() => {
        server.destroy();
        console.log("Server destroyed");
    }, 6000);
});

```

### Using a Fixed Connection Key

Optionally, you can set a `buffSeed` to ensure the server generates the same connection key every time:

```javascript
server.serve({
    port: 5000,
    address: "127.0.0.1",
    buffSeed: "4917816487c1822049939ff1abbf515663275105d01361bbc84fe2000e594539"
}, () => {
    console.log("Server started");
    console.log(server.getPublicKey());

    setTimeout(() => {
        server.destroy();
        console.log("Server destroyed");
    }, 6000);
});

// Note: buffSeed must be a 64-character long string.

```

### Destroying the Server

Use the `destroy` method to stop the server and clean up resources:

```javascript
server.destroy();
```

----------

## API Reference

### `server.serve(options, callback)`

Starts the server

#### Parameters:

-   `options` (object):
    
    -   `port` (number, required): The port to listen on.
    -   `address` (string, required): The local address to bind to. Use `"0.0.0.0"` to listen on all interfaces.
    -   `buffSeed` (string, optional): A 64-character string used to generate a consistent connection key.
    -   `secure` (boolean, optional, recommended): Prevents leaking access capability to HyperDHT by listening on a different seed than the one needed to connect.
    -   `udp` (boolean, optional): Enables UDP instead of TCP connections.
-   `callback` (function): A function that is called when the server successfully starts.
    

----------

### `server.getPublicKey()`

Retrieves the server's public key. Use this key to connect to the server from a client.

----------

### `server.destroy()`

Stops the server and cleans up resources.

----------

## License

Holesail Server is released under the [GPL-v3 License](https://www.gnu.org/licenses/gpl-3.0.en.html).

For more details, see the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file.

----------

## Community and Support

Join our [Discord Support Server](https://discord.gg/TQVacE7Vnj) for help, discussions, and updates.
