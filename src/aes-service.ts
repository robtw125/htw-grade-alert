import { webcrypto } from 'node:crypto';

export default class AESService {
  public static async create(base64Key: string) {
    const key = await webcrypto.subtle.importKey(
      'raw',
      Buffer.from(base64Key, 'base64'),
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    return new AESService(key);
  }

  private constructor(private key: webcrypto.CryptoKey) {}

  public static async generateKey() {
    const key = await webcrypto.subtle.generateKey({
      name: 'AES-GCM',
      length: 256
    } , true, ['encrypt', 'decrypt']);

    const exported  = await webcrypto.subtle.exportKey('raw', key);
    const exportedKeyBuffer = Buffer.from(exported);

    return exportedKeyBuffer.toString('base64');
  }

  public async encrypt(plainText: string) {
    const plainTextBuffer = Buffer.from(plainText, 'utf-8');

    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await webcrypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.key,
      plainTextBuffer
    );

    const combined = Buffer.concat([iv, Buffer.from(cipherBuffer)]);
    return combined.toString('base64');
  }

  public async decrypt(base64string: string) {
    const combinedBuffer = Buffer.from(base64string, 'base64');

    const iv = combinedBuffer.subarray(0, 12);
    const cipher = combinedBuffer.subarray(12);

    const plainTextBuffer = await webcrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.key,
      cipher
    );

    return Buffer.from(plainTextBuffer).toString('utf-8');
  }
}

const key = Buffer.from(
  await webcrypto.subtle.exportKey(
    'raw',
    await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ])
  )
).toString('base64');