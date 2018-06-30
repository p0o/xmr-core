// Copyright (c) 2014-2018, MyMonero.com
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//	conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//	of conditions and the following disclaimer in the documentation and/or other
//	materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be
//	used to endorse or promote products derived from this software without specific
//	prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
// STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
// THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

import async from "async";
import monero_config from "monero_utils/monero_config";
import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import monero_paymentID_utils from "monero_utils/monero_paymentID_utils";
import { NetType } from "cryptonote_utils/nettype";
import {
	RawTarget,
	JSBigInt,
	Pid,
	ViewSendKeys,
	ParsedTarget,
} from "./internal_libs/types";
import {
	calculateFee,
	multiplyFeePriority,
	calculateFeeKb,
} from "./internal_libs/fee_utils";
import { minMixin } from "./mixin_utils";
import { Status, sendFundStatus } from "./status_update_constants";
import { ERR } from "./internal_libs/errors";
import { Log } from "./internal_libs/logger";

export function estimatedTransactionNetworkFee(
	nonZeroMixin: number,
	feePerKB: JSBigInt,
	simplePriority: number,
) {
	const numOfInputs = 2; // this might change -- might select inputs
	const numOfOutputs =
		1 /*dest*/ + 1 /*change*/ + 0; /*no mymonero fee presently*/
	// TODO: update est tx size for bulletproofs
	// TODO: normalize est tx size fn naming
	const estimatedTxSize = monero_utils.estimateRctSize(
		numOfInputs,
		nonZeroMixin,
		numOfOutputs,
	);
	const estFee = calculateFee(
		feePerKB,
		estimatedTxSize,
		multiplyFeePriority(simplePriority),
	);
	//
	return estFee;
}

export function SendFunds(
	targetAddress: string, // currency-ready wallet address, but not an OpenAlias address (resolve before calling)
	nettype: NetType,
	amountorZeroWhenSweep: number, // n value will be ignored for sweep
	isSweeping: boolean, // send true to sweep - amountorZeroWhenSweep will be ignored
	senderPublicAddress: string,
	senderPrivateKeys: ViewSendKeys,
	senderPublicKeys: ViewSendKeys,
	nodeAPI: any, // TODO: possibly factor this dependency
	moneroOpenaliasUtils: any,
	pid: Pid,
	mixin: number,
	simplePriority: number,
	updateStatusCb: (status: Status) => void,
	successCb: (
		targetAddress: string,
		sentAmount: number,
		pid: Pid,
		txHash: string,
		txFee: JSBigInt,
	) => void,
	errCb: (err: Error) => void,
) {
	const isRingCT = true;

	if (mixin < minMixin()) {
		return errCb(ERR.RING.INSUFF);
	}
	//
	// parse & normalize the target descriptions by mapping them to Monero addresses & amounts
	const targetAmount = isSweeping ? 0 : amountorZeroWhenSweep;
	const target: RawTarget = {
		address: targetAddress,
		amount: targetAmount,
	};
	parseTargets(
		moneroOpenaliasUtils,
		[target], // requires a list of descriptions - but SendFunds was
		// not written with multiple target support as MyMonero does not yet support it
		nettype,
		function(_err, _parsedTargets) {
			if (_err) {
				return errCb(_err);
			}

			if (!_parsedTargets || _parsedTargets.length === 0) {
				return errCb(ERR.DEST.INVAL);
			}

			const single_target = _parsedTargets[0];
			if (!single_target) {
				return errCb(ERR.DEST.INVAL);
			}
			_prepare_to_send_to_target(single_target);
		},
	);
	function _prepare_to_send_to_target(parsedTarget: ParsedTarget) {
		const _targetAddress = parsedTarget.address;
		const _target_amount = parsedTarget.amount;
		//
		const feelessTotal = new JSBigInt(_target_amount);

		Log.Amount.beforeFee(feelessTotal, isSweeping);

		if (!isSweeping && feelessTotal.compare(0) <= 0) {
			return errCb(ERR.AMT.INSUFF);
		}

		//
		// Derive/finalize some values…
		let _pid = pid;
		let encryptPid = false; // we don't want to encrypt payment ID unless we find an integrated one

		// NOTE: refactor this out, its already done in resolve_targets
		var decoded_address;
		try {
			decoded_address = monero_utils.decode_address(
				_targetAddress,
				nettype,
			);
		} catch (e) {
			return errCb(Error(e.toString()));
		}

		// assert that the target address is not of type integrated nor subaddress
		// if a payment id is included
		if (pid) {
			if (decoded_address.intPaymentId) {
				return errCb(ERR.PID.NO_INTEG_ADDR);
			} else if (monero_utils.is_subaddress(_targetAddress, nettype)) {
				return errCb(ERR.PID.NO_SUB_ADDR);
			}
		}

		// if the target address is integrated
		// then encrypt the payment id
		// and make sure its also valid
		if (decoded_address.intPaymentId) {
			_pid = decoded_address.intPaymentId;
			encryptPid = true;
		} else if (
			!monero_paymentID_utils.IsValidPaymentIDOrNoPaymentID(_pid)
		) {
			return errCb(ERR.PID.INVAL);
		}

		_getUsableUnspentOutsForMixin(
			_targetAddress,
			feelessTotal,
			_pid,
			encryptPid,
		);
	}
	function _getUsableUnspentOutsForMixin(
		_targetAddress: string,
		_feelessTotal: JSBigInt,
		_pid: Pid,
		_encryptPid: boolean,
	) {
		updateStatusCb(sendFundStatus.fetching_latest_balance);
		nodeAPI.UnspentOuts(
			senderPublicAddress,
			senderPrivateKeys.view,
			senderPublicKeys.spend,
			senderPrivateKeys.spend,
			mixin,
			isSweeping,
			function(
				err: Error,
				unspentOuts,
				_unusedOuts,
				_dynFeePerKB: JSBigInt,
			) {
				if (err) {
					return errCb(err);
				}
				Log.Fee.dynPerKB(_dynFeePerKB);

				_proceedTo_constructFundTransferListAndSendFundsByUsingUnusedUnspentOutsForMixin(
					_targetAddress,
					_feelessTotal,
					_pid,
					_encryptPid,
					_unusedOuts,
					_dynFeePerKB,
				);
			},
		);
	}
	function _proceedTo_constructFundTransferListAndSendFundsByUsingUnusedUnspentOutsForMixin(
		_targetAddress: string,
		_feelessTotalAmount: JSBigInt,
		_pid: Pid,
		_encryptPid: boolean,
		_unusedOuts,
		_dynamicFeePerKB: JSBigInt,
	) {
		// status: constructing transaction…
		const _feePerKB = _dynamicFeePerKB;
		// Transaction will need at least 1KB fee (or 13KB for RingCT)
		const _minNetworkTxSizeKb = /*isRingCT ? */ 13; /* : 1*/
		const _estMinNetworkFee = calculateFeeKb(
			_feePerKB,
			_minNetworkTxSizeKb,
			multiplyFeePriority(simplePriority),
		);
		// now we're going to try using this minimum fee but the function will be called again
		// if we find after constructing the whole tx that it is larger in kb than
		// the minimum fee we're attempting to send it off with
		_attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
			_targetAddress,
			_feelessTotalAmount,
			_pid,
			_encryptPid,
			_unusedOuts,
			_feePerKB, // obtained from server, so passed in
			_estMinNetworkFee,
		);
	}
	function _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
		_targetAddress: string,
		_feelessTotal: JSBigInt,
		_pid: Pid,
		_encryptPid: boolean,
		_unusedOuts,
		_feePerKB: JSBigInt,
		_estMinNetworkFee: JSBigInt,
	) {
		// Now we need to establish some values for balance validation and to construct the transaction
		updateStatusCb(sendFundStatus.calculating_fee);

		let estMinNetworkFee = _estMinNetworkFee; // we may change this if isRingCT
		// const hostingService_chargeAmount = hostedMoneroAPIClient.HostingServiceChargeFor_transactionWithNetworkFee(attemptAt_network_minimumFee)
		let totalAmount: JSBigInt;
		if (isSweeping) {
			totalAmount = new JSBigInt("18450000000000000000"); //~uint64 max
		} else {
			totalAmount = _feelessTotal.add(
				estMinNetworkFee,
			); /*.add(hostingService_chargeAmount) NOTE service fee removed for now */
		}

		Log.Balance.requiredPreRCT(totalAmount, isSweeping);

		const usableOutputsAndAmounts = outputsAndAmountForMixin(
			totalAmount,
			_unusedOuts,
			isRingCT,
			isSweeping,
		);
		// v-- now if RingCT compute fee as closely as possible before hand
		const usingOuts = usableOutputsAndAmounts.usingOuts;
		const usingOutsAmount = usableOutputsAndAmounts.usingOutsAmount;
		const remainingUnusedOuts = usableOutputsAndAmounts.remainingUnusedOuts; // this is a copy of the pre-mutation usingOuts
		if (/*usingOuts.length > 1 &&*/ isRingCT) {
			let newNeededFee = calculateFee(
				_feePerKB,
				monero_utils.estimateRctSize(usingOuts.length, mixin, 2),
				multiplyFeePriority(simplePriority),
			);
			// if newNeededFee < neededFee, use neededFee instead (should only happen on the 2nd or later times through (due to estimated fee being too low))
			if (newNeededFee.compare(estMinNetworkFee) < 0) {
				newNeededFee = estMinNetworkFee;
			}
			if (isSweeping) {
				/* 
				// When/if sending to multiple destinations supported, uncomment and port this:					
				if (dsts.length !== 1) {
					deferred.reject("Sweeping to multiple accounts is not allowed");
					return;
				}
				*/
				_feelessTotal = usingOutsAmount.subtract(newNeededFee);
				if (_feelessTotal.compare(0) < 1) {
					return errCb(ERR.BAL.insuff(usingOutsAmount, newNeededFee));
				}
				totalAmount = _feelessTotal.add(newNeededFee);
			} else {
				totalAmount = _feelessTotal.add(newNeededFee);
				// add outputs 1 at a time till we either have them all or can meet the fee
				while (
					usingOutsAmount.compare(totalAmount) < 0 &&
					remainingUnusedOuts.length > 0
				) {
					const out = popRandElement(remainingUnusedOuts);

					Log.Output.display(out);

					// and recalculate invalidated values
					newNeededFee = calculateFee(
						_feePerKB,
						monero_utils.estimateRctSize(
							usingOuts.length,
							mixin,
							2,
						),
						multiplyFeePriority(simplePriority),
					);
					totalAmount = _feelessTotal.add(newNeededFee);
				}
			}

			Log.Fee.basedOnInputs(newNeededFee, usingOuts);

			estMinNetworkFee = newNeededFee;
		}

		Log.Balance.requiredPostRct(totalAmount);

		// Now we can validate available balance with usingOutsAmount (TODO? maybe this check can be done before selecting outputs?)
		const outsCmpToTotalAmounts = usingOutsAmount.compare(totalAmount);
		const outsLessThanTotal = outsCmpToTotalAmounts < 0;
		const outsGreaterThanTotal = outsCmpToTotalAmounts > 0;
		const outsEqualToTotal = outsCmpToTotalAmounts === 0;

		if (outsLessThanTotal) {
			return errCb(ERR.BAL.insuff(usingOutsAmount, totalAmount));
		}
		// Now we can put together the list of fund transfers we need to perform
		const fundTargets: ParsedTarget[] = []; // to build…
		// I. the actual transaction the user is asking to do
		fundTargets.push({
			address: _targetAddress,
			amount: _feelessTotal,
		});
		// II. the fee that the hosting provider charges
		// NOTE: The fee has been removed for RCT until a later date
		// fundTransferDescriptions.push({
		//			 address: hostedMoneroAPIClient.HostingServiceFeeDepositAddress(),
		//			 amount: hostingService_chargeAmount
		// })
		// III. some amount of the total outputs will likely need to be returned to the user as "change":
		if (outsGreaterThanTotal) {
			if (isSweeping) {
				throw ERR.SWEEP.TOTAL_NEQ_OUTS;
			}
			const changeAmount = usingOutsAmount.subtract(totalAmount);

			Log.Amount.change(changeAmount);

			if (isRingCT) {
				// for RCT we don't presently care about dustiness so add entire change amount
				Log.Amount.toSelf(changeAmount, senderPublicAddress);

				fundTargets.push({
					address: senderPublicAddress,
					amount: changeAmount,
				});
			} else {
				// pre-ringct
				// do not give ourselves change < dust threshold
				const [
					changeDivDustQuotient,
					changeDivDustRemainder,
				] = changeAmount.divRem(monero_config.dustThreshold);

				Log.Amount.changeAmountDivRem([
					changeDivDustQuotient,
					changeDivDustRemainder,
				]);

				if (!changeDivDustRemainder.isZero()) {
					// miners will add dusty change to fee
					Log.Fee.belowDustThreshold(changeDivDustRemainder);
				}
				if (!changeDivDustQuotient.isZero()) {
					// send non-dusty change to our address
					const usableChange = changeDivDustQuotient.multiply(
						monero_config.dustThreshold,
					);

					Log.Amount.toSelf(usableChange, senderPublicAddress);

					fundTargets.push({
						address: senderPublicAddress,
						amount: usableChange,
					});
				}
			}
		} else if (outsEqualToTotal) {
			// this should always fire when sweeping
			if (isRingCT) {
				// then create random destination to keep 2 outputs always in case of 0 change
				const fakeAddress = monero_utils.create_address(
					monero_utils.random_scalar(),
					nettype,
				).public_addr;

				Log.Output.uniformity(fakeAddress);

				fundTargets.push({
					address: fakeAddress,
					amount: JSBigInt.ZERO,
				});
			}
		}

		Log.Target.display(fundTargets);

		if (mixin < 0 || isNaN(mixin)) {
			return errCb(ERR.MIXIN.INVAL);
		}
		if (mixin > 0) {
			// first, grab RandomOuts, then enter __createTx
			updateStatusCb(sendFundStatus.fetching_decoy_outputs);
			nodeAPI.RandomOuts(usingOuts, mixin, function(
				_err: Error,
				_amount_outs,
			) {
				if (_err) {
					errCb(_err);
					return;
				}
				_createTxAndAttemptToSend(_amount_outs);
			});
			return;
		} else {
			// mixin === 0: -- PSNOTE: is that even allowed?
			_createTxAndAttemptToSend();
		}
		function _createTxAndAttemptToSend(mixOuts?: any) {
			updateStatusCb(sendFundStatus.constructing_transaction);
			var signedTx;
			try {
				Log.Target.fullDisplay(fundTargets);

				var targetViewKey; // need to get viewkey for encrypting here, because of splitting and sorting
				if (_encryptPid) {
					targetViewKey = monero_utils.decode_address(
						_targetAddress,
						nettype,
					).view;

					Log.Target.viewKey(targetViewKey);
				}
				var splitDestinations = monero_utils.decompose_tx_destinations(
					fundTargets,
					isRingCT,
				);

				Log.Target.displayDecomposed(splitDestinations);

				signedTx = monero_utils.create_transaction(
					senderPublicKeys,
					senderPrivateKeys,
					splitDestinations,
					usingOuts,
					mixOuts,
					mixin,
					_estMinNetworkFee,
					_pid,
					_encryptPid,
					targetViewKey,
					0,
					isRingCT,
					nettype,
				);
			} catch (e) {
				return errCb(ERR.TX.failure(e));
			}
			console.log("signed tx: ", JSON.stringify(signedTx));
			//
			var serialized_signedTx;
			var tx_hash;
			if (signedTx.version === 1) {
				serialized_signedTx = monero_utils.serialize_tx(signedTx);
				tx_hash = monero_utils.cn_fast_hash(serialized_signedTx);
			} else {
				const raw_tx_and_hash = monero_utils.serialize_rct_tx_with_hash(
					signedTx,
				);
				serialized_signedTx = raw_tx_and_hash.raw;
				tx_hash = raw_tx_and_hash.hash;
			}
			console.log("tx serialized: " + serialized_signedTx);
			console.log("Tx hash: " + tx_hash);
			//
			// work out per-kb fee for transaction and verify that it's enough
			var txBlobBytes = serialized_signedTx.length / 2;
			var numKB = Math.floor(txBlobBytes / 1024);
			if (txBlobBytes % 1024) {
				numKB++;
			}
			console.log(
				txBlobBytes +
					" bytes <= " +
					numKB +
					" KB (current fee: " +
					monero_utils.formatMoneyFull(_estMinNetworkFee) +
					")",
			);
			const feeActuallyNeededByNetwork = calculateFeeKb(
				_feePerKB,
				numKB,
				multiplyFeePriority(simplePriority),
			);
			// if we need a higher fee
			if (feeActuallyNeededByNetwork.compare(_estMinNetworkFee) > 0) {
				console.log(
					"💬  Need to reconstruct the tx with enough of a network fee. Previous fee: " +
						monero_utils.formatMoneyFull(_estMinNetworkFee) +
						" New fee: " +
						monero_utils.formatMoneyFull(
							feeActuallyNeededByNetwork,
						),
				);
				// this will update status back to .calculatingFee
				_attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
					_targetAddress,
					_feelessTotal,
					_pid,
					_encryptPid,
					_unusedOuts,
					_feePerKB,
					feeActuallyNeededByNetwork, // we are re-entering this codepath after changing this feeActuallyNeededByNetwork
				);
				//
				return;
			}

			// generated with correct per-kb fee
			const final_networkFee = _estMinNetworkFee; // just to make things clear
			console.log(
				"💬  Successful tx generation, submitting tx. Going with final_networkFee of ",
				monero_utils.formatMoney(final_networkFee),
			);

			updateStatusCb(sendFundStatus.submitting_transaction);

			nodeAPI.SubmitSerializedSignedTransaction(
				senderPublicAddress,
				senderPrivateKeys.view,
				serialized_signedTx,
				function(err: Error) {
					if (err) {
						return errCb(
							Error(
								"Something unexpected occurred when submitting your transaction: " +
									err,
							),
						);
					}
					const tx_fee = final_networkFee; /*.add(hostingService_chargeAmount) NOTE: Service charge removed to reduce bloat for now */
					successCb(
						_targetAddress,
						isSweeping
							? parseFloat(
									monero_utils.formatMoneyFull(_feelessTotal),
							  )
							: targetAmount,
						_pid,
						tx_hash,
						tx_fee,
					); // 🎉
				},
			);
		}
	}
}

//
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
function parseTargets(
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
				return _cb(
					Error(
						"Please supply a target address and a target amount.",
					),
				);
			}
			const target_address = target.address;
			const target_amount = target.amount.toString(); // we are converting it to a string here because parseMoney expects a string
			// now verify/parse address and amount
			if (
				moneroOpenaliasUtils.DoesStringContainPeriodChar_excludingAsXMRAddress_qualifyingAsPossibleOAAddress(
					target_address,
				)
			) {
				return _cb(
					Error(
						"You must resolve this OpenAlias address to a Monero address before calling SendFunds",
					),
				);
			}
			// otherwise this should be a normal, single Monero public address
			try {
				monero_utils.decode_address(target_address, nettype); // verify that the address is valid
			} catch (e) {
				return _cb(
					Error(`Couldn't decode address ${target_address} : ${e}`),
				);
			}
			// amount
			try {
				const parsed_amount: JSBigInt = monero_utils.parseMoney(
					target_amount,
				);
				return _cb(null, {
					address: target_address,
					amount: parsed_amount,
				});
			} catch (e) {
				return _cb(
					Error(`Couldn't parse amount ${target_amount} : ${e}`),
				);
			}
		},
		(err: Error, resolved_targets: ParsedTarget[]) => {
			cb(err, resolved_targets);
		},
	);
}

function popRandElement<T>(list: T[]) {
	var idx = Math.floor(Math.random() * list.length);
	var val = list[idx];
	list.splice(idx, 1);
	return val;
}

function outputsAndAmountForMixin(
	targetAmount: JSBigInt,
	unusedOuts,
	isRingCT: boolean,
	sweeping: boolean,
) {
	console.log(
		"Selecting outputs to use. target: " +
			monero_utils.formatMoney(targetAmount),
	);
	var usingOutsAmount = new JSBigInt(0);
	const usingOuts = [];
	const remainingUnusedOuts = unusedOuts.slice(); // take copy so as to prevent issue if we must re-enter tx building fn if fee too low after building
	while (
		usingOutsAmount.compare(targetAmount) < 0 &&
		remainingUnusedOuts.length > 0
	) {
		var out = popRandElement(remainingUnusedOuts);
		if (!isRingCT && out.rct) {
			// out.rct is set by the server
			continue; // skip rct outputs if not creating rct tx
		}
		const outAmount = new JSBigInt(out.amount);
		if (outAmount.compare(monero_config.dustThreshold) < 0) {
			// amount is dusty..
			if (!sweeping) {
				console.log(
					"Not sweeping, and found a dusty (though maybe mixable) output... skipping it!",
				);
				continue;
			}
			if (!out.rct) {
				console.log(
					"Sweeping, and found a dusty but unmixable (non-rct) output... skipping it!",
				);
				continue;
			} else {
				console.log(
					"Sweeping and found a dusty but mixable (rct) amount... keeping it!",
				);
			}
		}
		usingOuts.push(out);
		usingOutsAmount = usingOutsAmount.add(outAmount);
		console.log(
			`Using output: ${monero_utils.formatMoney(
				outAmount,
			)} - ${JSON.stringify(out)}`,
		);
	}
	return {
		usingOuts,
		usingOutsAmount,
		remainingUnusedOuts,
	};
}
