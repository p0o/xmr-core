import { KeyPair } from "@xmr-core/xmr-types";

export interface Account {
	spend: KeyPair;
	view: KeyPair;
	public_addr: string;
}
