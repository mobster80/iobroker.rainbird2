/**
 * Rain Bird async client
 * Pure JavaScript implementation of pyrainbird async_client.py
 */

const http = require('http');
const { PayloadCoder } = require('./encryption');
const { encode, decode } = require('./protocol');

const HEAD = {
    'Accept-Language': 'en',
    'Accept-Encoding': 'gzip, deflate',
    'User-Agent': 'RainBird/2.0 CFNetwork/811.5.4 Darwin/16.7.0',
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'Content-Type': 'application/octet-stream'
};

/**
 * Rain Bird Client
 */
class RainbirdClient {
    constructor(host, password, logger) {
        this.host = host;
        this.password = password;
        this.logger = logger || console;
        
        if (host.startsWith('/') || host.startsWith('http://')) {
            this.url = host;
        } else {
            this.url = `http://${host}/stick`;
        }
        
        this.coder = new PayloadCoder(password, this.logger);
    }
    
    /**
     * Make a request to the Rain Bird controller
     */
    async request(method, params) {
        params = params || {};
        
        // Encode the command - the params contain the encoded data string
        const payload = this.coder.encodeCommand(method, params);
        
        return new Promise((resolve, reject) => {
            const url = new URL(this.url);
            const options = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: 'POST',
                headers: {
                    ...HEAD,
                    'Content-Length': Buffer.byteLength(payload)
                }
            };
            
            const req = http.request(options, (res) => {
                if (res.statusCode === 503) {
                    reject(new Error('Rain Bird device is busy; Wait and try again'));
                    return;
                }
                
                if (res.statusCode === 403) {
                    reject(new Error('Rain Bird device denied authentication; Incorrect Password?'));
                    return;
                }
                
                if (res.statusCode !== 200) {
                    reject(new Error(`Rain Bird responded with status ${res.statusCode}`));
                    return;
                }
                
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    try {
                        const content = Buffer.concat(chunks);
                        const result = this.coder.decodeCommand(content);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
            
            req.on('error', (err) => {
                reject(new Error(`Error communicating with Rain Bird device: ${err.message}`));
            });
            
            req.setTimeout(20000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.write(payload);
            req.end();
        });
    }
}

/**
 * Rain Bird Controller
 */
class RainbirdController {
    constructor(client) {
        this.client = client;
        this.cache = {};
        this.model = null;
    }
    
    /**
     * Get model and version information
     */
    async getModelAndVersion() {
        const commandData = encode('ModelAndVersionRequest');
        const response = await this.client.request('ModelAndVersionRequest', { data: commandData });
        const data = decode(response.data);
        
        return {
            modelID: data.modelID,
            protocolRevisionMajor: data.protocolRevisionMajor,
            protocolRevisionMinor: data.protocolRevisionMinor
        };
    }
    
    /**
     * Get available stations
     */
    async getAvailableStations(page) {
        page = page || 0;
        const command = encode('AvailableStationsRequest', page);
        const response = await this.client.request('AvailableStationsRequest', { data: command });
        const data = decode(response.data);
        
        // Convert station mask to array
        const mask = data.setStations;
        const stations = [];
        
        for (let i = 0; i < 32; i++) {
            const bit = (mask >> i) & 1;
            if (bit) {
                stations.push(i + 1);
            }
        }
        
        return {
            count: stations.length,
            stations: stations
        };
    }
    
    /**
     * Get serial number
     */
    async getSerialNumber() {
        const commandData = encode('SerialNumberRequest');
        const response = await this.client.request('SerialNumberRequest', { data: commandData });
        const data = decode(response.data);
        
        return data.serialNumber.toString(16).toUpperCase().padStart(16, '0');
    }
    
    /**
     * Get current time
     */
    async getCurrentTime() {
        const commandData = encode('CurrentTimeRequest');
        const response = await this.client.request('CurrentTimeRequest', { data: commandData });
        const data = decode(response.data);
        
        return {
            hour: data.hour,
            minute: data.minute,
            second: data.second
        };
    }
    
    /**
     * Get current date
     */
    async getCurrentDate() {
        const commandData = encode('CurrentDateRequest');
        const response = await this.client.request('CurrentDateRequest', { data: commandData });
        const data = decode(response.data);
        
        return {
            year: data.year,
            month: data.month,
            day: data.day
        };
    }
    
    /**
     * Get rain sensor state
     */
    async getRainSensorState() {
        const commandData = encode('CurrentRainSensorStateRequest');
        const response = await this.client.request('CurrentRainSensorStateRequest', { data: commandData });
        const data = decode(response.data);
        
        return data.sensorState !== 0;
    }
    
    /**
     * Get zone states (active stations)
     */
    async getZoneStates(page) {
        page = page || 0;
        const command = encode('CurrentStationsActiveRequest', page);
        const response = await this.client.request('CurrentStationsActiveRequest', { data: command });
        const data = decode(response.data);
        
        // Convert station mask to array
        const mask = data.activeStations;
        const activeStations = [];
        
        for (let i = 0; i < 32; i++) {
            const bit = (mask >> i) & 1;
            if (bit) {
                activeStations.push(i + 1);
            }
        }
        
        return {
            activeStations: activeStations
        };
    }
    
    /**
     * Get current irrigation state
     */
    async getCurrentIrrigation() {
        const commandData = encode('CurrentIrrigationStateRequest');
        const response = await this.client.request('CurrentIrrigationStateRequest', { data: commandData });
        const data = decode(response.data);
        
        return data.irrigationState !== 0;
    }
    
    /**
     * Get rain delay
     */
    async getRainDelay() {
        const commandData = encode('RainDelayGetRequest');
        const response = await this.client.request('RainDelayGetRequest', { data: commandData });
        const data = decode(response.data);
        
        return data.delaySetting;
    }
    
    /**
     * Set rain delay
     */
    async setRainDelay(duration) {
        const command = encode('RainDelaySetRequest', duration);
        const response = await this.client.request('RainDelaySetRequest', { data: command });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
    
    /**
     * Irrigate a zone
     */
    async irrigateZone(zone, duration) {
        const command = encode('ManuallyRunStationRequest', zone, duration);
        const response = await this.client.request('ManuallyRunStationRequest', { data: command });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
    
    /**
     * Stop irrigation
     */
    async stopIrrigation() {
        const commandData = encode('StopIrrigationRequest');
        const response = await this.client.request('StopIrrigationRequest', { data: commandData });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
    
    /**
     * Test a zone
     */
    async testZone(zone) {
        const command = encode('TestStationsRequest', zone);
        const response = await this.client.request('TestStationsRequest', { data: command });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
    
    /**
     * Advance to next zone
     */
    async advanceZone(zone) {
        zone = zone || 0;
        const command = encode('AdvanceStationRequest', zone);
        const response = await this.client.request('AdvanceStationRequest', { data: command });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
    
    /**
     * Get water budget
     */
    async getWaterBudget(program) {
        program = program || 0;
        const command = encode('WaterBudgetRequest', program);
        const response = await this.client.request('WaterBudgetRequest', { data: command });
        const data = decode(response.data);
        
        return {
            programCode: data.programCode,
            seasonalAdjust: data.seasonalAdjust
        };
    }
    
    /**
     * Run a program
     */
    async runProgram(program) {
        const command = encode('ManuallyRunProgramRequest', program);
        const response = await this.client.request('ManuallyRunProgramRequest', { data: command });
        const data = decode(response.data);
        
        return { acknowledged: data.type === 'AcknowledgeResponse' };
    }
}

/**
 * Create a controller instance
 */
function createController(host, password, logger) {
    const client = new RainbirdClient(host, password, logger);
    return new RainbirdController(client);
}

module.exports = {
    RainbirdClient,
    RainbirdController,
    createController
};
