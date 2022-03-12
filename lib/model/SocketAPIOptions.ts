export type SocketAPIOptions = {
	/**
	 * Whether the socket should reconnect automatically or not.
	 * 
	 * Upon successful reconnection, this `net.Socket` emits the `reconnected` event.
	 */
	reconnect?: boolean;

	 /**
	  * The number of maximum consecutive (the internal number of retries gets reset after each successful reconnection) reconnection attempts.
	  * Set this to `-1` to remove the constraint and retry indefinitely.
	  * 
	  * Default: `3`.
	  */
	reconnectMaxRetries?: number;
 
	 /**
	  * The wait time between reconnection attempts. Expressed in milliseconds.
	  * 
	  * Default: `8000`ms.
	  */
	reconnectTimeout?: number;
 
	 /**
	  * The time it takes, in milliseconds, for a connection request to be considered timed out. 
	  * 
	  * Default: `8000`ms.
	  */
	connectTimeout?: number;

	/**
	  * The time it takes, in milliseconds, for an API request to be considered timed out. 
	  * 
	  * Default: `2000`ms.
	  */
	requestTimeout?: number;

	/**
	 * The frequency of heartbeat checks. This is useful in determining whether the remote host is responsive or not.
	 */
	heartbeatCheckInterval?: number;

	/**
	 * Whether to output debug heartbeat logs or not.
	 */
	noHeartbeatLogs?: boolean;
};