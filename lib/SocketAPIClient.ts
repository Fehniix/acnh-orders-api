import { TypedEmitter } from 'tiny-typed-emitter';
import { AsyncSocket } from './async-socket/AsyncSocket';
import { SocketAPIMessage } from './model/SocketAPIMessage';
import { SocketAPIOptions } from './model/SocketAPIOptions';
import { SocketAPIRequest } from './model/SocketAPIRequest';

import _debug from 'debug';
const debug = _debug('socketAPIClient');

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
export class SocketAPIClient {
	/**
	 * Remote .NET server socket instance. 
	 */
	private socket: AsyncSocket;

	/**
	 * Used to notify whenever a message was received from the server, for ID validation.
	 */
	private eventEmitter: TypedEmitter<InternalSocketEvent>;

	/**
	 * The heartbeat timer.
	 */
	private heartbeatInterval?: NodeJS.Timer;

	/**
	 * Useful in determining whether or not the remote host is responsive.
	 */
	private receivedHeartbeat: boolean = false;

	private readonly defaultRequestTimeout: number = 2000;
	private readonly defaultHeartbeatInterval: number = 8000;

	private ipAddress!: string;
	private port!: number;
	private options?: SocketAPIOptions;

	public constructor() {
		this.socket = new AsyncSocket();
		this.eventEmitter = new TypedEmitter<InternalSocketEvent>();
	}

	/**
	 * Establishes a TCP communication channel with the server designated by the supplied endpoint. 
	 * @param ipAddress The IP address of the server.
	 * @param port The port on which the server is accepting new clients.
	 * @param options Configuration object.
	 */
	public async start(ipAddress: string, port: number, options?: SocketAPIOptions): Promise<boolean> {
		if (this.isConnected())
			return false;

		this.ipAddress = ipAddress;
		this.port = port;
		this.options = options;

		this.socket = new AsyncSocket();

		this.socket.on('timeout', () => { 
			debug('Underlying socket timeout.');
			this.socket.destroy();
		});

		this.socket.on('close', () => { 
			debug('Underlying socket closed.');
		});

		this.socket.on('reconnectFailed', err => {
			debug('Reconnection failed with the following error: %o', err);
		});

		this.socket.on('reconnected', () => {
			debug('Successfully reconnected to host.');
			this.startHeartbeatCheckTimer();
		});

		try {
			await this.socket.asyncConnect(port, ipAddress, options)
		} catch(ex) {
			debug('Connection failed. Error: %o', ex);

			return false;
		}

		this.startHeartbeatCheckTimer();
				
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
				if (decodedResponse.startsWith('hb')) {
					this.respondToHeartbeat(decodedResponse);
					return;
				}

				let response;
				try {
					response = JSON.parse(decodedResponse) as SocketAPIMessage<unknown>
				} catch(ex) {
					debug('There was an error parsing the SocketAPIMessage: %o', ex);
					debug(`Decoded message: ${decodedResponse}`);
				}

				if (response === undefined || !this.isInstanceOfSocketAPIMessage(response))
					return;

				this.eventEmitter.emit('messageReceived', response);

				if (response._type === 'event')
					this.eventEmitter.emit('eventReceived', response);
			});
		});

		return true;
	}

	/**
	 * Starts the heartbeat check timer.
	 * It allows the client to detect an half-open connection and handle it.
	 */
	private startHeartbeatCheckTimer(): void {
		debug('Started heartbeat check timer.');

		this.heartbeatInterval = setInterval(() => {
			if (this.receivedHeartbeat)
				return;

			if (this.heartbeatInterval === undefined)
				return;

			clearInterval(this.heartbeatInterval);

			debug(`No heartbeat from server received in the last ${this.options?.heartbeatCheckInterval ?? this.defaultHeartbeatInterval}ms, connection closed. Calling .start().`);

			this.socket.removeAllListeners();
			this.socket.destroy();
			this.socket = new AsyncSocket();

			this.start(this.ipAddress, this.port, this.options);
		}, this.options?.heartbeatCheckInterval ?? this.defaultHeartbeatInterval);
	}

	/**
	 * Responds to server's heartbeat request.
	 */
	private respondToHeartbeat(heartbeatPacket: string): void {
		if (!(this.options?.noHeartbeatLogs ?? false))
			debug(`Received heartbeat: ${heartbeatPacket}`);

		this.receivedHeartbeat = true;
		this.socket.write(heartbeatPacket);

		if (!(this.options?.noHeartbeatLogs ?? false))
			debug(`Responded to heartbeat: ${heartbeatPacket}`);
	}

	/**
	 * Sends a request to the remote .NET server and returns the server's response.
	 * @param request The `SocketAPIRequest` instance to send to the .NET server.
	 * @param timeout The number of milliseconds after which a response is to be considered lost.
	 * @rejects If the `AsyncSocket` is not connected, the request `id` is undefined, or if the request times out.
	 */
	public async sendRequest<T>(request: SocketAPIRequest, timeout: number = this.defaultRequestTimeout): Promise<SocketAPIMessage<T>> {
		return new Promise<SocketAPIMessage<T>>((resolve, reject) => {
			if (!this.isConnected())
				reject('AsyncSocket not connected.');

			if (request.id === undefined)
				reject('request.id must be defined.');

			this.socket.write(JSON.stringify(request), 'utf8', err => {
				if (err !== undefined)
					debug('There was an error while attempting to send a request to the server: %o', err);
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
	 * @returns `true` if connected to SysBot.NET
	 */
	public isConnected(): boolean {
		return this.socket.connected;
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