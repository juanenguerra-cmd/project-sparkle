const ENCRYPTION_KEY =
  import.meta.env.VITE_ENCRYPTION_KEY || 'sparkle-default-key-CHANGE-IN-PRODUCTION-min-32-chars';

if (ENCRYPTION_KEY === 'sparkle-default-key-CHANGE-IN-PRODUCTION-min-32-chars') {
  console.warn('⚠️ Using default encryption key. Set VITE_ENCRYPTION_KEY in production!');
}

const xorWithKey = (input: string): string =>
  input
    .split('')
    .map((char, index) => String.fromCharCode(char.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(index % ENCRYPTION_KEY.length)))
    .join('');

export const encrypt = (data: string): string => {
  try {
    return btoa(xorWithKey(data));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

export const decrypt = (encryptedData: string): string => {
  try {
    return xorWithKey(atob(encryptedData));
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

export const encryptObject = <T>(obj: T): string => encrypt(JSON.stringify(obj));

export const decryptObject = <T>(encryptedData: string): T => JSON.parse(decrypt(encryptedData));
