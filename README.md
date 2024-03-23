# holesail-server
[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Create and announce your server on the HyperDHT P2P protocol.

## Installation
```shell
npm i holesail-server 
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
Optionally ou can also set a buffSeed to generate the same connection key every time
```js
server.serve(5000, '127.0.0.1', () => {
  console.log('Server 1 started');
},"4917816487c1822049939ff1abbf515663275105d01361bbc84fe2000e594539");
//buffSeed needs to be of 64 char long
```
```
Destroy the DHT server
```js
server.destroy();
```