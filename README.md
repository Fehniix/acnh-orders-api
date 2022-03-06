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
const _connected: boolean = await SocketAPIClient.start('127.0.0.1', 9001, {
    reconnect: true,
    reconnectMaxRetries: 10,
    reconnectTimeout: 4000,
    connectTimeout: 8000,
    requestTimeout: 4000
});

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

## Reconnection

By passing a `SocketAPIOptions` object to the `.start()` method as third parameter, it is possible for the client to automatically reconnect to the initially designated host.

Other options can be specified too:

```javascript
{
    reconnect: true,            // Whether to enable auto-reconnect logic or not.
    reconnectMaxRetries: 10,    // The maximum number of reconnect retries.
    reconnectTimeout: 4000,     // The time that between a reconnection attempt and the next.
    connectTimeout: 8000,       // The time it takes for the first connection (.start()) attempt to be considered timed out.
    requestTimeout: 4000        // The time it takes for a request to the host to be considered timed out.
}
```

## License

GNU General Public License, see `LICENSE` for details. Pull requests are more than welcome, help & suggestions are very much appreciated. :)
