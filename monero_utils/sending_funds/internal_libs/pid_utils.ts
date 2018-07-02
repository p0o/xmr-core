import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import monero_paymentID_utils from "monero_utils/monero_paymentID_utils";
import { NetType } from "cryptonote_utils/nettype";
import { ERR } from "./errors";

export function checkAddressAndPidValidity(
	address: string,
	nettype: NetType,
	pid: string | null,
) {
	let retPid = pid;
	let encryptPid = false;

	const decodedAddress = monero_utils.decode_address(address, nettype);
	// assert that the target address is not of type integrated nor subaddress
	// if a payment id is included
	if (retPid) {
		if (decodedAddress.intPaymentId) {
			throw ERR.PID.NO_INTEG_ADDR;
		} else if (monero_utils.is_subaddress(address, nettype)) {
			throw ERR.PID.NO_SUB_ADDR;
		}
	}

	// if the target address is integrated
	// then encrypt the payment id
	// and make sure its also valid
	if (decodedAddress.intPaymentId) {
		retPid = decodedAddress.intPaymentId;
		encryptPid = true;
	} else if (!monero_paymentID_utils.IsValidPaymentIDOrNoPaymentID(retPid)) {
		throw ERR.PID.INVAL;
	}

	return { pid: retPid, encryptPid };
}
