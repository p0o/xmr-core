import { send } from "./send-tx";
jest.setTimeout(99999999);

describe("send-tx", () => {
	it("should allow simple sending with a ledger", done => {
		const address =
			"48fUumQbGgfar6KDbvgg5sSJyEcrQQbF1DKPmz9f5PiDa395XT41Mtge5n5L6XTYARceTwi3Zb1wug6EHRnGQTs4TPYhYso";
		const amount = 0.01;
		const pid = "abcdefffffffffff";
		send(address, amount, pid);
		setTimeout(() => {
			done();
		}, 99999999);
	});
});
