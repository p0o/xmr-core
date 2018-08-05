import { send } from "./send-tx";
jest.setTimeout(99999999);

describe("send-tx", () => {
	it("should allow simple sending with a ledger", done => {
		const address =
			"46WhbYQYsJzdp3BVigsbFpFTG3ahq7QbcWJX8w9m48HUitAdQkqfJWDPfZUTWnqTv9jafzXwzbdWpWjh6HQeoBFUTTWVtuA";
		const amount = 0.01;
		send(address, amount, null);
		setTimeout(() => {
			done();
		}, 99999999);
	});
});
