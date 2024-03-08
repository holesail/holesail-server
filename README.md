# holesail-server
[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Create and announce your server on the HyperDHT P2P protocol.

## Installation
```shell
npm i holesail-server --save-dev
```
## Usage
Require a module
```js
const DHT = require('holesail-server')
```
Create instance of the holesailServer class
```js
const server =  new DHT();
```
Start DHT and get the public key
```js
server.serve(5000, '127.0.0.1', () => {
  console.log('Server 1 started');
});

console.log('Server public key:', server.getPublicKey());
```
Destroy the DHT server
```js
server.destroy();
```