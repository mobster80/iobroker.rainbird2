/**
 * Rain Bird IQ4 Cloud API Client using iq4-cli bridge
 * 
 * Uses the existing iq4-cli Go binary which handles auth correctly.
 * This is a pragmatic solution until the Node.js auth flow is fixed.
 */

'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

class RainBirdCloudCLI {
    constructor(cliPath, log) {
        this.cliPath = cliPath || '~/.openclaw/workspace/skills/rainbird-iq4/iq4-cli';
        this.log = log || console;
    }

    /**
     * Execute iq4-cli command and parse JSON output
     */
    async _exec(command) {
        try {
            const fullCommand = `cd $(dirname ${this.cliPath}) && ${this.cliPath} ${command}`;
            const { stdout, stderr } = await execPromise(fullCommand);
            
            if (stderr) {
                this.log.debug(`CLI stderr: ${stderr}`);
            }
            
            // Parse JSON output
            return JSON.parse(stdout);
        } catch (error) {
            this.log.error(`CLI command failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if CLI is authenticated (has valid token)
     */
    async isAuthenticated() {
        try {
            await this._exec('controllers');
            return true;
        } catch (error) {
            return false;
        }
    }

    // ==================== Controllers ====================

    async getControllers() {
        return await this._exec('controllers');
    }

    // ==================== Stations ====================

    async getStations(controllerId) {
        return await this._exec(`stations ${controllerId}`);
    }

    // ==================== Programs ====================

    async getPrograms(controllerId) {
        return await this._exec(`programs ${controllerId}`);
    }

    async getProgram(programId) {
        return await this._exec(`program ${programId}`);
    }

    async getRuntimes(controllerId) {
        return await this._exec(`runtimes ${controllerId}`);
    }

    async getStartTimes(controllerId) {
        return await this._exec(`start-times ${controllerId}`);
    }

    // ==================== Program Control ====================

    async setSeasonalAdjust(programId, percent) {
        await this._exec(`set-adjust ${programId} ${percent}`);
        return { success: true };
    }

    async setWaterDays(programId, days) {
        await this._exec(`set-days ${programId} ${days}`);
        return { success: true };
    }

    async addStartTime(programId, time) {
        // Validate 15-minute interval
        const [hours, minutes] = time.split(':').map(Number);
        if (minutes % 15 !== 0) {
            throw new Error(`Start time must be in 15-minute intervals (:00, :15, :30, :45). Got: ${time}`);
        }
        
        const output = await this._exec(`add-start ${programId} ${time}`);
        return output;
    }

    async deleteStartTime(programId, startTimeId) {
        await this._exec(`del-start ${programId} ${startTimeId}`);
        return { success: true };
    }

    async setRuntime(stepId, minutes) {
        await this._exec(`set-runtime ${stepId} ${minutes}m`);
        return { success: true };
    }

    async addStation(programId, stationId) {
        await this._exec(`add-step ${programId} ${stationId}`);
        return { success: true };
    }

    async removeStation(stepId) {
        await this._exec(`del-step ${stepId}`);
        return { success: true };
    }
}

module.exports = RainBirdCloudCLI;
