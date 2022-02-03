# SysBot.NET TypeScript API

![Code Size](https://img.shields.io/github/languages/code-size/fehniix/sysbot-net-api)
![npm Total Downloads](https://img.shields.io/npm/dt/sysbot-net-api)
![GitHub Open Issues](https://img.shields.io/github/issues-raw/fehniix/sysbot-net-api)

A very simple and lightweight TypeScript package that allows to subscribe to events coming from SysBot.ACNHOrders and make HTTP-like requests to it, via SysBot's SocketAPIServer.

## Installation

```bash
npm install -S sysbot-net-api
```

## Usage

```typescript
import { SocketAPIClient, SocketAPIRequest, SocketAPIMessage } from 'sysbot-net-api';

// Start the client
const _connected: boolean = await SocketAPIClient.start('127.0.0.1', 9001);

SocketAPIClient.subscribe(message => {
    console.log('Event received!', message); // Instance of `SocketAPIMessage`
});

// Take a look at request format below!
const request: SocketAPIRequest<{ myNum: number }> = new SocketAPIRequest<{ myNum: number }>('addOne', JSON.stringify({
    myArg: 2
}));

const response: SocketAPIMessage<number> = await SocketAPIClient.sendRequest<number>(request, 2000);
// response: 3
```

## Request format

- `id`: a unique identifier for the request. This can be either manually or automatically assigned: by accessing the `id` property of your `SocketAPIRequest` instance or by passing it to the constructor. If none is passed to the constructor, a random UUID is generated and assigned to it.
- `endpoint`: the endpoint name of the remote bot method to call. **Case-sensitive**.
- `args`: a JSON-formatted object string that will be passed to the endpoint. If a non-JSON valid string is given, it will be first JSON encoded.

## Response format - `SocketAPIMessage<T>`

- `status`: either "okay" or "error".
- `id`: the ID that was provided by the request.
- `_type`: the type of response, can be either `event` or `response`; used internally.
- `value`: contains the response body, the actual value of the response; `undefined` if the remote endpoint returns `Void`.
- `error`: if the remote endpoint catches or throws an error, this would contain the error message.

## License

GNU General Public License, see `LICENSE` for details. Pull requests are more than welcome, help & suggestions are very much appreciated. :)
