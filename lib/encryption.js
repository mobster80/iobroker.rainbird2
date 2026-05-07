/**
 * Rain Bird encryption/decryption utilities
 * Pure JavaScript implementation of pyrainbird encryption
 */

const crypto = require('crypto');

const BLOCK_SIZE = 16;
const INTERRUPT = '\x00';
const PAD = '\x10';

/**
 * Add padding to data
 */
function addPadding(data) {
    const newDataLen = data.length;
    const remainingLen = BLOCK_SIZE - (newDataLen % BLOCK_SIZE);
    const toPadLen = remainingLen === BLOCK_SIZE ? 0 : remainingLen;
    const padString = PAD.repeat(toPadLen);
    return data + padString;
}

/**
 * Decrypt encrypted data using the password
 */
function decrypt(encryptedData, password) {
    const iv = encryptedData.slice(32, 48);
    const encrypted = encryptedData.slice(48);
    
    const hash = crypto.createHash('sha256');
    hash.update(password, 'utf8');
    const symmetricKey = hash.digest().slice(0, 32);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', symmetricKey, iv);
    decipher.setAutoPadding(false);
    
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    
    return decrypted;
}

/**
 * Encrypt data using the password
 */
function encrypt(data, password) {
    const toCodeData = data + '\x00\x10';
    
    // Create symmetric key from password
    const keyHash = crypto.createHash('sha256');
    keyHash.update(password, 'utf8');
    const symmetricKey = keyHash.digest();
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Pad the data
    const paddedData = addPadding(toCodeData);
    
    // Create data hash
    const dataHash = crypto.createHash('sha256');
    dataHash.update(data, 'utf8');
    const dataHashDigest = dataHash.digest();
    
    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', symmetricKey, iv);
    cipher.setAutoPadding(false);
    
    const encrypted = Buffer.concat([
        cipher.update(paddedData, 'utf8'),
        cipher.final()
    ]);
    
    // Combine hash + iv + encrypted data
    return Buffer.concat([dataHashDigest, iv, encrypted]);
}

/**
 * PayloadCoder class for encoding/decoding commands
 */
class PayloadCoder {
    constructor(password, logger) {
        this.password = password;
        this.logger = logger || console;
    }
    
    /**
     * Encode a command for transmission
     */
    encodeCommand(method, params) {
        const requestId = Date.now();
        const data = {
            id: requestId,
            jsonrpc: '2.0',
            method: method,
            params: params
        };
        const sendData = JSON.stringify(data);
        
        this.logger.debug && this.logger.debug(`Request: ${sendData}`);
        
        if (!this.password) {
            return sendData;
        }
        
        return encrypt(sendData, this.password);
    }
    
    /**
     * Decode a response
     */
    decodeCommand(content) {
        let decoded;
        
        if (this.password) {
            const decrypted = decrypt(content, this.password);
            decoded = decrypted
                .toString('utf8')
                .replace(/\x10+$/, '')
                .replace(/\x0A+$/, '')
                .replace(/\x00+$/, '')
                .trim();
        } else {
            decoded = content.toString('utf8');
        }
        
        this.logger.debug && this.logger.debug(`Response: ${decoded}`);
        
        const response = JSON.parse(decoded);
        
        if (response.error) {
            const error = response.error;
            let msg = 'Error from controller';
            if (error.code !== undefined) {
                msg += `, Code: ${error.code}`;
            }
            if (error.message) {
                msg += `, Message: ${error.message}`;
            }
            this.logger.warn && this.logger.warn(msg);
            throw new Error(`Rain Bird responded with an error: ${error.message || 'Unknown error'}`);
        }
        
        return response.result;
    }
}

module.exports = {
    PayloadCoder,
    encrypt,
    decrypt
};
