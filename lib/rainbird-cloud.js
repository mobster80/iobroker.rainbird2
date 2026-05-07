/**
 * Rain Bird IQ4 Cloud API Client
 * 
 * For ESP-TM2 and other MQTT-enabled controllers that don't support local API.
 * Based on the IQ4 cloud platform used by Rain Bird 2.0 app.
 * 
 * API Documentation: https://github.com/nickustinov/rainbird-iq4-cli/blob/main/docs/IQ4-API.md
 */

'use strict';

const axios = require('axios');
const crypto = require('crypto');

class RainBirdCloudAPI {
    constructor(username, password, log) {
        this.username = username;
        this.password = password;
        this.log = log || console;
        
        this.baseUrl = 'https://iq4server.rainbird.com/coreapi/api';
        this.identityServerUrl = 'https://iq4server.rainbird.com/coreidentityserver';
        
        this.token = null;
        this.tokenExpiry = null;
        this.companyId = null;
    }

    /**
     * Authenticate with Rain Bird IQ4 cloud
     * Uses OpenID Connect implicit flow
     */
    async authenticate() {
        try {
            this.log.info('Authenticating with Rain Bird IQ4 cloud...');
            
            // Step 1: Get login page and extract request verification token
            const loginPageUrl = `${this.identityServerUrl}/connect/authorize` +
                `?client_id=C5A6F324-3CD3-4B22-9F78-B4835BA55D25` +
                `&redirect_uri=https://iq4.rainbird.com/auth.html` +
                `&response_type=id_token token` +
                `&scope=coreAPI.read coreAPI.write openid profile` +
                `&nonce=${this._generateNonce()}` +
                `&state=${this._generateState()}`;
            
            const loginPageResponse = await axios.get(loginPageUrl, {
                maxRedirects: 0,
                validateStatus: (status) => status < 400
            });
            
            // Step 2: Extract antiforgery token from form
            const antiForgeryToken = this._extractAntiForgeryToken(loginPageResponse.data);
            if (!antiForgeryToken) {
                throw new Error('Could not extract anti-forgery token from login page');
            }
            
            // Step 3: POST credentials
            const loginData = new URLSearchParams({
                '__RequestVerificationToken': antiForgeryToken,
                'Username': this.username,
                'Password': this.password,
                'button': 'login',
                'RememberLogin': 'false'
            });
            
            const loginResponse = await axios.post(
                `${this.identityServerUrl}/account/login`,
                loginData.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': this._extractCookies(loginPageResponse.headers)
                    },
                    maxRedirects: 0,
                    validateStatus: (status) => status < 400
                }
            );
            
            // Step 4: Follow redirects to get token from fragment
            const fragmentUrl = this._extractRedirectUrl(loginResponse);
            if (!fragmentUrl) {
                throw new Error('Authentication failed - no redirect URL');
            }
            
            // Extract token from fragment (#access_token=...)
            const tokenMatch = fragmentUrl.match(/[#&]access_token=([^&]+)/);
            if (!tokenMatch) {
                throw new Error('Authentication failed - no access token in response');
            }
            
            this.token = tokenMatch[1];
            
            // JWT tokens typically expire in ~2 hours
            // We'll parse the JWT to get exact expiry
            this.tokenExpiry = this._parseTokenExpiry(this.token);
            
            this.log.info(`Authentication successful. Token expires at ${new Date(this.tokenExpiry).toISOString()}`);
            
            return true;
        } catch (error) {
            this.log.error(`Authentication failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Ensure we have a valid token, refresh if needed
     */
    async _ensureAuthenticated() {
        if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 60000) {
            // Token expired or expires in less than 1 minute
            await this.authenticate();
        }
    }

    /**
     * Make authenticated API request
     */
    async _request(method, endpoint, data = null) {
        await this._ensureAuthenticated();
        
        const config = {
            method,
            url: `${this.baseUrl}/${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                // Token might be invalid, try re-auth once
                this.log.warn('Received 401, re-authenticating...');
                this.token = null;
                await this.authenticate();
                
                // Retry request with new token
                config.headers['Authorization'] = `Bearer ${this.token}`;
                const retryResponse = await axios(config);
                return retryResponse.data;
            }
            throw error;
        }
    }

    // ==================== Controllers ====================

    /**
     * Get all controllers (satellites)
     */
    async getControllers() {
        const data = await this._request('GET', 'Satellite/GetSatelliteList');
        return data;
    }

    /**
     * Get controller connection status
     */
    async getControllerStatus(controllerId) {
        const data = await this._request('GET', `Satellite/isConnected?satelliteIds=${controllerId}`);
        return data;
    }

    // ==================== Stations ====================

    /**
     * Get stations for a controller
     */
    async getStations(controllerId) {
        const data = await this._request('GET', `Station/GetStationListForSatellite?satelliteId=${controllerId}`);
        return data;
    }

    // ==================== Programs ====================

    /**
     * Get all programs for a controller
     */
    async getPrograms(controllerId) {
        const data = await this._request('GET', `Program/GetProgramList?satelliteId=${controllerId}`);
        return data;
    }

    /**
     * Get full program detail (with start times and runtimes)
     */
    async getProgram(programId) {
        const data = await this._request('GET', `Program/GetProgram?programId=${programId}`);
        return data;
    }

    /**
     * Get runtimes for all stations on a controller
     */
    async getRuntimes(controllerId) {
        const data = await this._request('GET', `ProgramStep/GetProgramsAssignedAndRunTimeBySatelliteId?satelliteId=${controllerId}`);
        return data;
    }

    /**
     * Get start times for a controller
     */
    async getStartTimes(controllerId) {
        const data = await this._request('GET', `Program/GetScheduledStartTimes?satelliteId=${controllerId}`);
        return data;
    }

    // ==================== Program Control ====================

    /**
     * Set seasonal adjust percentage for a program
     * @param {number} programId - Program ID
     * @param {number} percent - Percentage (0-300)
     */
    async setSeasonalAdjust(programId, percent) {
        const data = await this._request('PATCH', `Program/UpdateProgram?programId=${programId}`, {
            programAdjust: percent
        });
        return data;
    }

    /**
     * Set water days for a program
     * @param {number} programId - Program ID
     * @param {string} days - Binary string (e.g., "1010100" for Su,Tu,Th)
     */
    async setWaterDays(programId, days) {
        const data = await this._request('PATCH', `Program/UpdateProgram?programId=${programId}`, {
            weekDays: days
        });
        return data;
    }

    /**
     * Add a start time to a program
     * IMPORTANT: Times must be in 15-minute intervals (:00, :15, :30, :45)
     * @param {number} programId - Program ID
     * @param {string} time - Time in HH:MM format (e.g., "04:00")
     */
    async addStartTime(programId, time) {
        // Validate 15-minute interval
        const [hours, minutes] = time.split(':').map(Number);
        if (minutes % 15 !== 0) {
            throw new Error(`Start time must be in 15-minute intervals (:00, :15, :30, :45). Got: ${time}`);
        }
        
        const data = await this._request('POST', 'StartTime/CreateStartTime', {
            programId: programId.toString(),
            dateTime: `1999-09-09T${time}:00`, // Date portion is ignored by API
            enabled: true
        });
        return data;
    }

    /**
     * Delete a start time
     * @param {number} programId - Program ID
     * @param {number} startTimeId - Start time ID
     */
    async deleteStartTime(programId, startTimeId) {
        const data = await this._request('PATCH', 'StartTime/v2/UpdateBatches', {
            add: [],
            update: [],
            delete: {
                id: programId,
                ids: [startTimeId]
            }
        });
        return data;
    }

    /**
     * Set runtime for a program step (station assignment)
     * @param {number} stepId - Program step ID
     * @param {number} minutes - Runtime in minutes
     */
    async setRuntime(stepId, minutes) {
        // Convert minutes to .NET ticks (100-nanosecond units)
        const ticks = minutes * 60 * 10000000;
        
        const data = await this._request('PUT', `ProgramStep/UpdateProgramStep?programStepId=${stepId}`, {
            runTimeLong: ticks
        });
        return data;
    }

    /**
     * Assign a station to a program
     * @param {number} programId - Program ID
     * @param {number} stationId - Station ID
     */
    async addStation(programId, stationId) {
        const data = await this._request('POST', 'ProgramStep/CreateProgramSteps', [{
            actionId: 'RunStation',
            programId: programId.toString(),
            runTimeLong: null,
            stationId: stationId
        }]);
        return data;
    }

    /**
     * Remove a station from a program
     * @param {number} stepId - Program step ID
     */
    async removeStation(stepId) {
        const data = await this._request('DELETE', `ProgramStep/DeleteProgramStep?programStepId=${stepId}`);
        return data;
    }

    // ==================== Rain Delay ====================

    /**
     * Set rain delay
     * @param {number} controllerId - Controller ID
     * @param {number} days - Number of days (0 to clear)
     */
    async setRainDelay(controllerId, days) {
        // Note: This endpoint might need adjustment based on actual API
        // The pyrainbird local API uses different commands
        this.log.warn('Rain delay via cloud API not yet implemented');
        throw new Error('Rain delay control not yet supported via cloud API');
    }

    // ==================== Helper Methods ====================

    _generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    _generateState() {
        return crypto.randomBytes(16).toString('hex');
    }

    _extractAntiForgeryToken(html) {
        const match = html.match(/name="__RequestVerificationToken".*?value="([^"]+)"/);
        return match ? match[1] : null;
    }

    _extractCookies(headers) {
        const cookies = headers['set-cookie'];
        if (!cookies) return '';
        return cookies.map(cookie => cookie.split(';')[0]).join('; ');
    }

    _extractRedirectUrl(response) {
        if (response.headers.location) {
            return response.headers.location;
        }
        // Check for meta refresh or JavaScript redirect in HTML
        if (response.data && typeof response.data === 'string') {
            const metaMatch = response.data.match(/url=([^"']+)/);
            if (metaMatch) return metaMatch[1];
        }
        return null;
    }

    _parseTokenExpiry(token) {
        try {
            // JWT format: header.payload.signature
            const payload = token.split('.')[1];
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
            
            if (decoded.exp) {
                return decoded.exp * 1000; // Convert to milliseconds
            }
        } catch (error) {
            this.log.warn('Could not parse token expiry, assuming 2 hours');
        }
        
        // Default: 2 hours from now
        return Date.now() + (2 * 60 * 60 * 1000);
    }
}

module.exports = RainBirdCloudAPI;
