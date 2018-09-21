import { generate_parameters } from "./test_parameters";
import {
	genBorromean,
	verifyBorromean,
} from "xmr-transaction/src/libs/ringct/components/prove_range";

const { indi, P1v, P2v, xv } = generate_parameters();

it("borromean_2", () => {
	//#false one
	indi[3] = `${(+indi[3] + 1) % 2}`;
	const bb = genBorromean(xv, [P1v, P2v], indi); /*?.*/
	const valid = verifyBorromean(bb, P1v, P2v); /*?.*/
	expect(valid).toBe(false);
});
