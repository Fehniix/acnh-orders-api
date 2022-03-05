import { Socket } from "net";

/**
 * A simple thenable `net.Socket` implementation.
 * Adds the following events:
 * 
 * * `'reconnecting'`: raised whenever the connection gets closed.
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

	/**
	 * Resolves if connection to the supplied endpoint was successful, rejects otherwise.
	 * @param port The port of the remote endpoint.
	 * @param host The hostname of the remote endpoint.
	 */
	public async asyncConnect(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeoutHandler = () => {
				this._connected = false;
				console.log('asyncConnect timed out.');
				reject(new Error("The connection request timed out."));
			};
			const timeout = setTimeout(timeoutHandler, options?.connectTimeout ?? 8000);

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

			if (options?.reconnect === true)
				this.on('close', _hadError => {
					setTimeout(async () => {
						console.log('asyncConnect closed, reconnecting.');
						await this.reconnect(port, host, options);
					}, options?.reconnectTimeout ?? 8000);
				});
		});
	}

	/**
	 * Handles reconnection logic.
	 */
	private async reconnect(port: number, host: string, options?: AsyncSocketOptions): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const retryIndefinitely: boolean 	= options?.reconnectMaxRetries === -1;
			const withinMaxRetries: boolean 	= this.reconnectionAttempts < (options?.reconnectMaxRetries ?? 3);

			while (withinMaxRetries || retryIndefinitely) {
				this.reconnectionAttempts++;

				console.log('asyncConnect withinMaxRetries or retryIndefinitely, reconnecting.', this.reconnectionAttempts);
				this.emit('reconnecting');
	
				try {
					await this.asyncConnect(port, host, options);
					console.log('asyncConnect reconnected. Reset reconnectionAttempts.');
					this.reconnectionAttempts = options?.reconnectMaxRetries ?? 3;
					this.emit('reconnected');
					resolve();
				} catch(ex) {
					console.log('asyncConnect reconnect failed.');
					reject(ex);
				}
			}
	
			this.emit('error', new Error(`Maximum retries (${options?.reconnectMaxRetries ?? 3}) reached.`));
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
	 */
	reconnectTimeout?: number,

	/**
	 * The time it takes, in milliseconds, for a connection request to be considered timed out. 
	 * 
	 * Default: `8000`.
	 */
	connectTimeout?: number
};

export { AsyncSocket };