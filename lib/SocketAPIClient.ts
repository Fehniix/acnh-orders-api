import net from 'net';
import { TypedEmitter } from 'tiny-typed-emitter';
import { SocketAPIMessage } from './model/SocketAPIMessage';
import { SocketAPIRequest } from './model/SocketAPIRequest';

/**
 * Describes a set of internal events, used to race a server response (whose id corresponds to the request) with a timeout.
 */
interface InternalSocketEvent {
	'messageReceived': (message: SocketAPIMessage<unknown>) => void;
	'eventReceived': (message: SocketAPIMessage<any>) => void;
}

/**
 * The object responsible for sending requests to the .NET `SocketAPIServer`, receiving responses and subscribing to events emitted by the server.
 */
class SocketAPIClient {
	/**
	 * Whether the client successfully connected to the remote .NET server.
	 */
	private _connected: boolean;

	/**
	 * Remote .NET server socket instance. 
	 */
	private socket: net.Socket;

	/**
	 * Used to notify whenever a message was received from the server, for ID validation.
	 */
	private eventEmitter: TypedEmitter<InternalSocketEvent>;

	public constructor() {
		this.socket = new net.Socket();
		this.socket.setTimeout(2000);

		this.eventEmitter = new TypedEmitter<InternalSocketEvent>();

		this._connected = false;
	}

	/**
	 * Establishes a TCP communication channel with the server designated by the supplied endpoint. 
	 * @param ipAddress The IP address of the server.
	 * @param port The port on which the server is accepting new clients.
	 */
	public async start(ipAddress: string, port: number): Promise<boolean> {
		if (this._connected)
			return false;

		return new Promise<boolean>(resolve => {
			this.socket.connect(port, ipAddress);

			this.socket.once('connect', () => {
				this.socket.setTimeout(0);
				this._connected = true;
				resolve(true);
			});
			
			this.socket.on('data', data => {
				/**
				 * There are instances in which TCP packets get merged.
				 * The server `\0\0`-terminates each JSON-encoded `SocketAPIMessage`;
				 * reading each individually is as simple as splitting on `\0\0` and filtering out `null`.
				 */
				const decodedResponses: string[] = data.toString('utf8')
														.split('\0\0')
														.map(res => res.replace(/\0\0/gi, ''))
														.filter(res => !(res === '' || res === null));
				
				decodedResponses.forEach(decodedResponse => {
					let response;
					try {
						response = JSON.parse(decodedResponse) as SocketAPIMessage<unknown>
					} catch(ex) {
						console.log('There was an error parsing the SocketAPIMessage:', ex);
						console.log('Decoded message:', decodedResponse);
					}

					if (response === undefined || !this.isInstanceOfSocketAPIMessage(response))
						return;

					this.eventEmitter.emit('messageReceived', response);

					if (response._type === 'event')
						this.eventEmitter.emit('eventReceived', response);
				});
			});
			
			const errorHandler = () => { this._connected = false; this.socket.off('error', errorHandler); };
			this.socket.on('error', errorHandler);

			this.socket.once('timeout', () => { 
				this.socket.setTimeout(0);
				this.socket.destroy();
				resolve(false); 
			});

			this.socket.once('close', () => { this._connected = false; });
		});
	}

	/**
	 * Sends a request to the remote .NET server and returns the server's response.
	 * @param request The `SocketAPIRequest` instance to send to the .NET server.
	 * @param timeout The number of milliseconds after which a response is to be considered lost.
	 */
	public async sendRequest<T>(request: SocketAPIRequest, timeout: number = 2000): Promise<SocketAPIMessage<T>> {
		if (request.id === undefined)
			throw new ReferenceError('request.id must be defined.');

		return new Promise<SocketAPIMessage<T>>((resolve, reject) => {
			this.socket.write(JSON.stringify(request), 'utf8', err => {
				if (err !== undefined)
					console.log(err.message);
			});

			const _timeout = setTimeout(() => {
				reject(`The request with id = ${request.id} timed out after ${timeout}ms.`);
			}, timeout);

			const responseListener = (message: SocketAPIMessage<unknown>) => {
				if (message.id !== request.id)
					return;
				
				this.eventEmitter.off('messageReceived', responseListener);
				clearTimeout(_timeout);
				resolve(message as SocketAPIMessage<T>);
			};

			this.eventEmitter.on('messageReceived', responseListener);
		});
	}

	/**
	 * Subsribes to server-emitted events.
	 * @param callback The anonymous function that gets called whenever an event is fired by the .NET server.
	 */
	public subscribe<T>(callback: ((message: SocketAPIMessage<T>) => void)): void {
		this.eventEmitter.on('eventReceived', callback);
	}

	/**
	 * Removes the subscribed anonymous function from the internal event emitter.
	 * @param callback The reference-equal function that was previously used to subscribe to server-emitted events.
	 */
	public unsubscribe<T>(callback: ((message: SocketAPIMessage<T>) => void)): void {
		this.eventEmitter.off('eventReceived', callback);
	}

	/**
	 * `obj` type-guard. Determines whether `obj` conforms to the `SocketAPIMessage` interface.
	 */
	private isInstanceOfSocketAPIMessage(obj: any): obj is SocketAPIMessage<any> {
		return 	'status' in obj && (obj.status === 'okay' || obj.status === 'error') && 
				'_type' in obj && (obj._type === 'event' || obj._type === 'response') &&
				('error' in obj || 'value' in obj);
	}
}

export default new SocketAPIClient();