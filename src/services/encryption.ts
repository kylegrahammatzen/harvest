const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

let _key: CryptoKey | null = null;

async function getKey(encryptionKey: string): Promise<CryptoKey> {
	if (!_key) {
		const keyBytes = hexToBytes(encryptionKey);
		_key = await crypto.subtle.importKey(
			"raw",
			keyBytes as BufferSource,
			{ name: ALGORITHM },
			false,
			["encrypt", "decrypt"],
		);
	}
	return _key;
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
	const key = await getKey(encryptionKey);
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv, tagLength: TAG_LENGTH },
		key,
		encoded,
	);

	const ivHex = bytesToHex(iv);
	const ctHex = bytesToHex(new Uint8Array(ciphertext));
	return `${ivHex}:${ctHex}`;
}

export async function decrypt(encrypted: string, encryptionKey: string): Promise<string> {
	const key = await getKey(encryptionKey);
	const [ivHex, ctHex] = encrypted.split(":");
	const iv = hexToBytes(ivHex);
	const ciphertext = hexToBytes(ctHex);

	const plaintext = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv: iv as BufferSource, tagLength: TAG_LENGTH },
		key,
		ciphertext as BufferSource,
	);

	return new TextDecoder().decode(plaintext);
}
