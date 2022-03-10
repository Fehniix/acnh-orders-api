/**
 * Represents an event emitted by the remote bot.
 * You can expect the optional `value` field of the `SocketAPIMessage` object to conform to be of this type, if the emitted message is an event.
 */
export type SocketAPIEvent<T extends any> = {
	/**
	 * The name of the event that was emitted.
	 */
	eventName: string;

	/**
	 * The arguments supplied by the bot along with the event.
	 */
	eventArgs: T
};