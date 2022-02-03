import { randomUUID } from "crypto";

function isValidJSON(str: string): boolean {
	try { 
		JSON.parse(str ?? '');
	} catch {
		return false;
	}
	return true;
}

/**
 * Represents a socket API request.
 */
export class SocketAPIRequest {
	/**
	 * The unique identifier for the request.
	 */
	public id: string;

	/**
	 * Represents the name of the endpoint to remotely execute and from which to fetch the result.
	 */
	public endpoint: string;

	/**
	 * The JSON-formatted arguments string to pass to the endpoint.
	 */
	public args?: string;

	/**
	 * @param endpoint The name of the remote endpoint to call.
	 * @param id If not provided, a random UUID is generated and assigned.
	 */
	public constructor(endpoint: string, args?: string, id?: string) {
		this.endpoint = endpoint;
		this.id = id !== undefined ? id : randomUUID().toString();
		
		if (args === undefined)
			return;

		if (isValidJSON(args))
			this.args = args;
		else
			this.args = JSON.stringify(args);
	}
};