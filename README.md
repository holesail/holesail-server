# holesail-server
Create and announce your server on the HyperDHT, to be used with other Holesail modules.

## Installation
```shell
npm i holesail-server --save-dev
```
## Usage
Require a module
```js
const DHT = require('./index.js')
```
Create instance of the holesailServer class
```js
const server =  new DHT();
```
Start and get the public key
```js
server.serve(5000, '127.0.0.1');
console.log('Server public key:', server.getPublicKey());
```