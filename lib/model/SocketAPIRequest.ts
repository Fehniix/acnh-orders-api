/**
 * Represents a socket API request.
 */
export interface SocketAPIRequest {
	/**
	 * The unique identifier for the request.
	 */
	id: string,

	/**
	 * Represents the name of the endpoint to remotely execute and from which to fetch the result.
	 */
	endpoint: string,

	/**
	 * The JSON-formatted arguments string to pass to the endpoint.
	 */
	args?: string
};