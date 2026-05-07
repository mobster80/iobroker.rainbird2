/**
 * Unified Rain Bird Controller
 * 
 * Automatically detects if local API or cloud API should be used:
 * - Local API: For older controllers (RC2, ESP-RZX, etc.) with local WiFi
 * - Cloud API: For MQTT controllers (ESP-TM2, etc.) that only work via IQ4 cloud
 */

'use strict';

const RainBirdCloudAPI = require('./rainbird-cloud');
const rainbirdNative = require('./rainbird-native');

class RainBirdUnified {
    constructor(config, log) {
        this.config = config;
        this.log = log;
        
        this.useCloud = config.useCloudAPI || false;
        this.localClient = null;
        this.cloudClient = null;
    }

    /**
     * Initialize the appropriate client based on configuration
     */
    async init() {
        if (this.useCloud) {
            this.log.info('Initializing Rain Bird Cloud API client (IQ4)');
            
            if (!this.config.cloudUsername || !this.config.cloudPassword) {
                throw new Error('Cloud API requires username and password');
            }
            
            this.cloudClient = new RainBirdCloudAPI(
                this.config.cloudUsername,
                this.config.cloudPassword,
                this.log
            );
            
            await this.cloudClient.authenticate();
            
            // Get first controller as default
            const controllers = await this.cloudClient.getControllers();
            if (controllers && controllers.length > 0) {
                this.controllerId = controllers[0].id;
                this.log.info(`Using controller: ${controllers[0].name} (ID: ${this.controllerId})`);
            } else {
                throw new Error('No controllers found in Rain Bird cloud account');
            }
        } else {
            this.log.info('Initializing Rain Bird local API client');
            
            if (!this.config.ipaddress || !this.config.password) {
                throw new Error('Local API requires IP address and password');
            }
            
            this.localClient = new rainbirdNative(
                this.config.ipaddress,
                this.config.password,
                this.log
            );
        }
    }

    /**
     * Get available stations/zones
     */
    async getAvailableStations() {
        if (this.useCloud) {
            const stations = await this.cloudClient.getStations(this.controllerId);
            // Convert cloud API format to local API format
            return stations.map((station, index) => ({
                number: index + 1,
                id: station.id,
                name: station.name,
                available: true
            }));
        } else {
            return await this.localClient.getAvailableStations();
        }
    }

    /**
     * Get current irrigation status
     */
    async getCurrentIrrigation() {
        if (this.useCloud) {
            // Cloud API doesn't have a direct "current irrigation" endpoint
            // We need to check program status and active zones
            // For now, return placeholder
            this.log.warn('getCurrentIrrigation not yet fully implemented for cloud API');
            return {
                active: false,
                station: 0
            };
        } else {
            return await this.localClient.getCurrentIrrigation();
        }
    }

    /**
     * Run a zone manually
     */
    async testZone(zone, minutes) {
        if (this.useCloud) {
            this.log.warn('Manual zone control via cloud API requires program manipulation');
            // Cloud API doesn't support direct zone control
            // Would need to create a temporary program
            throw new Error('Manual zone control not supported via cloud API');
        } else {
            return await this.localClient.irrigateZone(zone, minutes);
        }
    }

    /**
     * Stop all irrigation
     */
    async stopIrrigation() {
        if (this.useCloud) {
            this.log.warn('Stop irrigation not yet implemented for cloud API');
            throw new Error('Stop irrigation not supported via cloud API');
        } else {
            return await this.localClient.stopIrrigation();
        }
    }

    /**
     * Get rain delay status
     */
    async getRainDelay() {
        if (this.useCloud) {
            const controllers = await this.cloudClient.getControllers();
            const controller = controllers.find(c => c.id === this.controllerId);
            return controller ? controller.rainDelay : 0;
        } else {
            return await this.localClient.getRainDelay();
        }
    }

    /**
     * Set rain delay
     */
    async setRainDelay(days) {
        if (this.useCloud) {
            return await this.cloudClient.setRainDelay(this.controllerId, days);
        } else {
            return await this.localClient.setRainDelay(days);
        }
    }

    /**
     * Get seasonal adjust / water budget
     */
    async getSeasonalAdjust() {
        if (this.useCloud) {
            const programs = await this.cloudClient.getPrograms(this.controllerId);
            // Return first program's seasonal adjust as default
            return programs.length > 0 ? programs[0].programAdjust : 100;
        } else {
            return await this.localClient.getWaterBudget();
        }
    }

    /**
     * Set seasonal adjust for a program
     */
    async setSeasonalAdjust(programId, percent) {
        if (this.useCloud) {
            return await this.cloudClient.setSeasonalAdjust(programId, percent);
        } else {
            this.log.warn('Seasonal adjust per program not supported in local API');
            // Local API has global water budget
            throw new Error('Per-program seasonal adjust only available via cloud API');
        }
    }

    /**
     * Get rain sensor state
     */
    async getRainSensor() {
        if (this.useCloud) {
            this.log.warn('Rain sensor state not available via cloud API');
            return false;
        } else {
            return await this.localClient.getRainSensor();
        }
    }

    /**
     * Get all programs
     */
    async getPrograms() {
        if (this.useCloud) {
            return await this.cloudClient.getPrograms(this.controllerId);
        } else {
            this.log.warn('Program listing not supported in local API');
            return [];
        }
    }

    /**
     * Run a program
     */
    async runProgram(programNumber) {
        if (this.useCloud) {
            this.log.warn('Manual program execution not yet implemented for cloud API');
            throw new Error('Manual program execution not supported via cloud API');
        } else {
            return await this.localClient.runProgram(programNumber);
        }
    }

    /**
     * Advance to next zone
     */
    async advanceZone() {
        if (this.useCloud) {
            this.log.warn('Advance zone not supported via cloud API');
            throw new Error('Advance zone not supported via cloud API');
        } else {
            return await this.localClient.advanceZone();
        }
    }
}

module.exports = RainBirdUnified;
