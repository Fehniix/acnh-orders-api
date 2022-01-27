import { SocketAPIRequest } from "./lib/model/SocketAPIRequest";
import SocketAPIClient from "./lib/SocketAPIClient";

(async() => {
	await SocketAPIClient.start('127.0.0.1', 5201);
	const res = await SocketAPIClient.sendRequest(new SocketAPIRequest('exampleEP'));
})();
