import { Socket } from "net";

import _debug from 'debug';
const debug = _debug('asyncSocket');

/**
 * A simple thenable `net.Socket` implementation.
 * Adds the following events:
 * 
 * * `'reconnecting'`: raised whenever the connection gets closed.
 * * `'reconnected'`: ...
 * * `'reconnectFailed'`: ...
 */
class AsyncSocket extends Socket {
	/**
	 * Whether a socket connection is currently established or not.
	 */
	private _connected: boolean = false;

	/**
	 * Whether a socket connection is currently established or not.
	 */
	public get connected(): boolean {
		return this._connected;
	}

	/**
	 * Indicates whether the `AsyncSocket` is currently through the reconnection process or not.
	 */
	private reconnecting: boolean = false;

	/**
	 * The current number of reconnection attempts.
	 */
	private reconnectionAttempts: number = 0;

	private port!: number;
	private host!: string;
	private options?: AsyncSocketOptions;

	// Default values.
	private readonly defaultConnectTimeout: number = 8000;
	private readonly defaultReconnectTimeout: number = 8000;
	private readonly defaultReconnectMaxRetries: number = 3;

	/**
	 * Resolves if connection to the supplied endpoint was successful, rejects otherwise.
	 * @param port The port of the remote endpoint.
	 * @param host The hostname of the remote endpoint.
	 */
	public async asyncConnect(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		this.port = port;
		this.host = host;
		this.options = options;

		if (options?.reconnect === true) {
			this.on('close', () => {
				this._connected = false;
				
				debug('Received "close" event.');

				if (!this.canReconnect(options!)) {
					debug('.canReconnect() === false.');
					return;
				}
				
				this.initiateReconnectionAttempts(port, host, options)
					.then(() => {
						debug('Reconnected successfully.');
					})
					.catch(ex => {
						debug('There was a problem while reconnecting to the host: %o', ex);
					});
			});
		}

		await this.asyncConnectNoRetry(port, host, options);
	}

	/**
	 * Used internally to connect to the remote host without handling retry logic.
	 * Useful to logically separate the act of connection to remote host and re-attempting to connect.
	 */
	private async asyncConnectNoRetry(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeoutHandler = () => {
				if (this._connected === true)
					return;

				this._connected = false;

				debug('Connection attempt timed out.');

				reject('The connection request timed out.');
			};
			const timeout = setTimeout(timeoutHandler, options?.connectTimeout ?? this.defaultConnectTimeout);

			const errorHandler = (err: Error) => {
				clearTimeout(timeout);
				this.removeListener('connect', connectHandler);

				this._connected = false;

				debug('Connection attempt failed, error raised: %o', err);

				reject(err);
			};
			this.once('error', errorHandler);
			
			const connectHandler = () => {
				clearTimeout(timeout);
				this.removeListener('error', errorHandler);

				this._connected = true;

				debug('Connection to the host was successful.');

				resolve();
			};
			this.once('connect', connectHandler);

			this.connect(port, host);
		});
	}

	/**
	 * A utility function that determines whether reconnection is possible or not.
	 * Reconnection is possible if:
	 * 1. The reconnection process is not currently on-going,
	 * 2. The number of attempts does not exceed the number of maximum attempts,
	 * 3. The connection was successfully established.
	 */
	private canReconnect(options: AsyncSocketOptions): boolean {
		if (this.connected)
			return false;

		if (this.reconnecting)
			return false;

		if (this.reconnectionAttempts >= (options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries))
			return false;

		return true;
	}

	/**
	 * Handles reconnection logic.
	 */
	private async initiateReconnectionAttempts(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		if (this.connected)
			throw new Error('AsyncSocket already connected, no need to reconnect.');

		if (this.reconnecting)
			throw new Error('AsyncSocket already reconnecting.');

		this.reconnecting = true;

		const retryIndefinitely = () => options?.reconnectMaxRetries === -1;
		const withinMaxRetries 	= () => this.reconnectionAttempts < (options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries);

		while((withinMaxRetries() || retryIndefinitely()) && !this.connected) {
			this.reconnectionAttempts++;

			this.emit('reconnecting');

			try {
				// Sleep.
				await new Promise(r => setTimeout(r, options?.reconnectTimeout ?? this.defaultReconnectTimeout));

				await this.asyncConnectNoRetry(port, host, options);

				this.reconnectionAttempts = 0;
				this.reconnecting = false;
				this._connected = true;

				this.emit('reconnected');
				return;
			} catch(ex) {
				debug(`Reconnection attempt #${this.reconnectionAttempts} failed. Retrying.`);
				this.emit('reconnectFailed', {
					error: ex, 
					attemptCount: this.reconnectionAttempts, 
					maxAttempts: options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries
				});
			}
		}

		this.reconnecting = false;

		throw new Error(`Maximum retries (${options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries}) reached.`);
	}

	/**
	 * Manually forces reconnection to the host.
	 * @throws A generic Error is thrown whenever:
	 * * `.asyncConnect(port, host, options?)` was never called before,
	 * * Connection to the host is already established,
	 * * A reconnection attempt is already on-going,
	 * * Reconnection to the host fails.
	 */
	public async reconnect(): Promise<void> {
		if (this.port === undefined || this.host === undefined)
			throw new Error('Could not reconnect. `asyncConnect` was never called before.');

		if (this.connected)
			throw new Error('Could not reconnect. Already connected, no need to reconnect.');

		if (this.reconnecting)
			throw new Error('Could not reconnect. Already reconnecting.');

		await this.asyncConnectNoRetry(this.port, this.host);
	}

	/**
	 * Signals this `AsyncSocket` instance that the remote host stopped sending heartbeats, initiating the reconnect sequence.
	 * @throws A generic Error is thrown whenever:
	 * * `.asyncConnect(port, host, options?)` was never called before,
	 * * Connection to the host is already established,
	 * * A reconnection attempt is already on-going,
	 * * Reconnection to the host fails.
	 */
	public flatlined(): void {
		debug('Flatlined.');

		this._connected = false;
		
		if (this.port === undefined || this.host === undefined)
			throw new Error('Could not reconnect. `asyncConnect` was never called before.');

		this.initiateReconnectionAttempts(this.port, this.host, this.options);
	}
}

type AsyncSocketOptions = {
	/**
	 * Whether the socket should reconnect automatically or not.
	 * 
	 * Upon successful reconnection, this `net.Socket` emits the `reconnected` event.
	 */
	reconnect?: boolean,

	/**
	 * The number of maximum consecutive (the internal number of retries gets reset after each successful reconnection) reconnection attempts.
	 * Set this to `-1` to remove the constraint and retry indefinitely.
	 * 
	 * Default: `3`.
	 */
	reconnectMaxRetries?: number,

	/**
	 * The wait time between reconnection attempts. Expressed in milliseconds.
	 * 
	 * Default: `8000`ms.
	 */
	reconnectTimeout?: number,

	/**
	 * The time it takes, in milliseconds, for a connection request to be considered timed out. 
	 * 
	 * Default: `8000`ms.
	 */
	connectTimeout?: number
};

export { AsyncSocket };