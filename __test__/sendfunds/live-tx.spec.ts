import { failingTxLedger, passingTxRaw } from "../fixtures/live-tx";
import { verRct } from "@xmr-core/xmr-transaction";

describe("tx tests", () => {
	it("should pass", async () => {
		const { keyimages, mixRing, signedTx } = passingTxRaw;
		await verRct(signedTx, false, mixRing, keyimages[0]);
	});

	it("should fail", async () => {
		const { keyimages, mixRing, rct_signatures } = failingTxLedger;
		await verRct(rct_signatures, false, mixRing, keyimages[0]);
	});
});
