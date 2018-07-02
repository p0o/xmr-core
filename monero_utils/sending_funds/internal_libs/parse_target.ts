import { ParsedTarget, RawTarget, JSBigInt } from "./types";
import { NetType } from "cryptonote_utils/nettype";
import async from "async";
import { ERR } from "./errors";
import monero_utils from "monero_utils/monero_cryptonote_utils_instance";

/**
 *
 * @description Validate & Normalize passed in target descriptions of {address, amount}.
 *
 * Checks if address is valid along with the amount.
 *
 * parse & normalize the target descriptions by mapping them to currency (Monero)-ready addresses & amounts
 * @param {*} moneroOpenaliasUtils
 * @param {RawTarget[]} targetsToParse
 * @param {NetType} nettype
 * @param {(err: Error | null, parsedTargets?: ParsedTarget[]) => void } cb
 */
export function parseTargets(
	moneroOpenaliasUtils: any,
	targetsToParse: RawTarget[],
	nettype: NetType,
	cb: (err: Error | null, parsedTargets?: ParsedTarget[]) => void,
) {
	async.mapSeries(
		targetsToParse,
		(
			target: RawTarget,
			_cb: (err: Error | null, res?: ParsedTarget) => void,
		) => {
			if (!target.address && !target.amount) {
				// PSNote: is this check rigorous enough?
				return _cb(ERR.PARSE_TRGT.EMPTY);
			}
			const targetAddress = target.address;
			const targetAmount = target.amount.toString(); // we are converting it to a string here because parseMoney expects a string
			// now verify/parse address and amount
			if (
				moneroOpenaliasUtils.DoesStringContainPeriodChar_excludingAsXMRAddress_qualifyingAsPossibleOAAddress(
					targetAddress,
				)
			) {
				return _cb(ERR.PARSE_TRGT.OA_RES);
			}
			// otherwise this should be a normal, single Monero public address
			try {
				monero_utils.decode_address(targetAddress, nettype); // verify that the address is valid
			} catch (e) {
				return _cb(ERR.PARSE_TRGT.decodeAddress(targetAddress, e));
			}
			// amount
			try {
				const parsedAmount: JSBigInt = monero_utils.parseMoney(
					targetAmount,
				);
				return _cb(null, {
					address: targetAddress,
					amount: parsedAmount,
				});
			} catch (e) {
				return _cb(ERR.PARSE_TRGT.amount(targetAmount, e));
			}
		},
		(err: Error, resolvedTargets: ParsedTarget[]) => {
			cb(err, resolvedTargets);
		},
	);
}
