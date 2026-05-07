/**
 * Simple test for native JavaScript implementation
 */

const { encode, decode } = require('./lib/protocol');
const { PayloadCoder } = require('./lib/encryption');

console.log('Testing Rain Bird protocol encoding/decoding...\n');

// Test 1: Encode ModelAndVersionRequest
console.log('Test 1: Encode ModelAndVersionRequest');
const cmd1 = encode('ModelAndVersionRequest');
console.log(`  Encoded: ${cmd1}`);
console.log(`  Expected: 02 (command code)`);
console.log(`  Result: ${cmd1 === '02' ? 'PASS' : 'FAIL'}\n`);

// Test 2: Encode AvailableStationsRequest with page 0
console.log('Test 2: Encode AvailableStationsRequest with page 0');
const cmd2 = encode('AvailableStationsRequest', 0);
console.log(`  Encoded: ${cmd2}`);
console.log(`  Expected: 0300 (command + page)`);
console.log(`  Result: ${cmd2 === '0300' ? 'PASS' : 'FAIL'}\n`);

// Test 3: Encode ManuallyRunStationRequest zone 3, duration 10 minutes (600 seconds = 0x258)
console.log('Test 3: Encode ManuallyRunStationRequest');
const cmd3 = encode('ManuallyRunStationRequest', 3, 600);
console.log(`  Encoded: ${cmd3}`);
console.log(`  Expected: 39030258 (command + zone + duration)`);
console.log(`  Result: ${cmd3 === '39030258' ? 'PASS' : 'FAIL'}\n`);

// Test 4: Decode ModelAndVersionResponse
console.log('Test 4: Decode ModelAndVersionResponse');
const response1 = '8200030105'; // Example: modelID=3, major=1, minor=5
const decoded1 = decode(response1);
console.log(`  Decoded:`, decoded1);
console.log(`  Expected: type=ModelAndVersionResponse, modelID=3, major=1, minor=5`);
console.log(`  Result: ${decoded1.type === 'ModelAndVersionResponse' && decoded1.modelID === 3 && decoded1.protocolRevisionMajor === 1 && decoded1.protocolRevisionMinor === 5 ? 'PASS' : 'FAIL'}\n`);

// Test 5: Decode AvailableStationsResponse
console.log('Test 5: Decode AvailableStationsResponse');
const response2 = '8300000000FF'; // Example: page 0, stations 1-8 active (0xFF = 11111111)
const decoded2 = decode(response2);
console.log(`  Decoded:`, decoded2);
console.log(`  Expected: type=AvailableStationsResponse, pageNumber=0, setStations=255`);
console.log(`  Result: ${decoded2.type === 'AvailableStationsResponse' && decoded2.pageNumber === 0 && decoded2.setStations === 255 ? 'PASS' : 'FAIL'}\n`);

// Test 6: PayloadCoder without encryption
console.log('Test 6: PayloadCoder without encryption (no password)');
const coder1 = new PayloadCoder(null, { debug: () => {}, warn: () => {} });
const encoded1 = coder1.encodeCommand('ModelAndVersionRequest', { data: '02' });
const json1 = JSON.parse(encoded1);
console.log(`  Encoded JSON:`, json1);
console.log(`  Expected: method=ModelAndVersionRequest, data=02`);
console.log(`  Result: ${json1.method === 'ModelAndVersionRequest' && json1.params.data === '02' ? 'PASS' : 'FAIL'}\n`);

// Test 7: PayloadCoder with encryption
console.log('Test 7: PayloadCoder with encryption');
const password = 'testpassword';
const coder2 = new PayloadCoder(password, { debug: () => {}, warn: () => {} });
const encoded2 = coder2.encodeCommand('ModelAndVersionRequest', { data: '02' });
console.log(`  Encrypted length: ${Buffer.byteLength(encoded2)} bytes`);
console.log(`  Expected: > 100 bytes (encrypted data)`);
console.log(`  Result: ${Buffer.byteLength(encoded2) > 100 ? 'PASS' : 'FAIL'}\n`);

// Test 8: PayloadCoder decrypt
console.log('Test 8: PayloadCoder encrypt/decrypt round-trip');
try {
    const original = '{"id":1234,"jsonrpc":"2.0","method":"ModelAndVersionRequest","params":{"data":"02"}}';
    const coder3 = new PayloadCoder(password, { debug: () => {}, warn: () => {} });
    
    // Encrypt
    const { encrypt } = require('./lib/encryption');
    const encrypted = encrypt(original, password);
    
    // Decrypt
    const { decrypt } = require('./lib/encryption');
    const decrypted = decrypt(encrypted, password)
        .toString('utf8')
        .replace(/\x10+$/, '')
        .replace(/\x0A+$/, '')
        .replace(/\x00+$/, '')
        .trim();
    
    console.log(`  Original length: ${original.length}`);
    console.log(`  Encrypted length: ${encrypted.length}`);
    console.log(`  Decrypted length: ${decrypted.length}`);
    console.log(`  Match: ${original === decrypted ? 'YES' : 'NO'}`);
    console.log(`  Result: ${original === decrypted ? 'PASS' : 'FAIL'}\n`);
} catch (err) {
    console.log(`  Error: ${err.message}`);
    console.log(`  Result: FAIL\n`);
}

console.log('All protocol tests completed!');
