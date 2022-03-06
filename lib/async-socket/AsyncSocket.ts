import { Socket } from "net";

/**
 * A simple thenable `net.Socket` implementation.
 * Adds the following events:
 * 
 * * `'reconnecting'`: raised whenever the connection gets closed.
 * * `'reconnected'`: ...
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
	 * The current number of reconnection attempts.
	 */
	private reconnectionAttempts: number = 0;

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
		return new Promise(async (resolve, reject) => {
			if (options?.reconnect === true)
				this.on('close', async _hadError => {
					console.log('asyncConnect closed, reconnecting. Had error:', _hadError);
					await this.reconnect(port, host, options);
				});

			await this.asyncConnectNoRetry(port, host, options);
		});
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
				console.log('asyncConnect timed out.');
				reject(new Error("The connection request timed out."));
			};
			const timeout = setTimeout(timeoutHandler, options?.connectTimeout ?? this.defaultConnectTimeout);

			const errorHandler = (err: Error) => {
				clearTimeout(timeout);
				this.removeAllListeners();
				this._connected = false;
				console.log('asyncConnect error.');
				reject(err);
			};
			this.once('error', errorHandler);

			// Connect raises a single `error` event in case connection were to be unsuccessful.
			// The callback parameter is equivalent to subscribing *once* to the `connect` event.
			this.connect(port, host, () => {
				clearTimeout(timeout);
				this.removeListener('error', errorHandler);
				this._connected = true;
				console.log('asyncConnect connected.');
				resolve();
			});
		});
	}

	/**
	 * Handles reconnection logic.
	 */
	private async reconnect(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const retryIndefinitely: boolean 	= options?.reconnectMaxRetries === -1;
			const withinMaxRetries: boolean 	= this.reconnectionAttempts < (options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries);

			while (withinMaxRetries || retryIndefinitely) {
				this.reconnectionAttempts++;

				console.log('asyncConnect withinMaxRetries or retryIndefinitely, reconnecting.', this.reconnectionAttempts);
				this.emit('reconnecting');
	
				try {
					// Sleep.
					await new Promise(r => setTimeout(r, options?.reconnectTimeout ?? this.defaultReconnectTimeout));

					await this.asyncConnectNoRetry(port, host, options);
					console.log('asyncConnect reconnected. Reset reconnectionAttempts.');
					this.reconnectionAttempts = 0;
					this.emit('reconnected');
					resolve();
				} catch(ex) {
					console.log('asyncConnect reconnect failed.');
					reject(ex);
				}
			}
	
			this.emit('error', new Error(`Maximum retries (${options?.reconnectMaxRetries ?? this.defaultReconnectMaxRetries}) reached.`));
		});
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