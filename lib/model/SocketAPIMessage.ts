/**
 * Represents a socket API message, otherwise "response".
 */
export interface SocketAPIMessage<T> {
	/**
	 * Describes whether the request completed successfully or not.
	 */
	status: 'error' | 'okay',

	/**
	 * The unique identifier of the associated request.
	 */
	id: string,

	/**
	 * Describes the type of response; i.e. event or response.
	 * Wrapper property used for encoding purposes.
	 */
	_type: 'response' | 'event',

	/**
	 * If an error occurred while processing the client's request, this property would contain the error message.
	 */
	error?: string,

	/**
	 * The actual body of the response, if any.
	 */
	value?: T
};