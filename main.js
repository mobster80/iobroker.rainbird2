'use strict';

/**
 * ioBroker.rainbird2
 * Rain Bird IQ4 Cloud API Adapter for MQTT Controllers (ESP-TM2)
 * 
 * This adapter uses the Rain Bird IQ4 Cloud API via iq4-cli bridge.
 * It is designed for MQTT-enabled controllers that don't support local API.
 */

const utils = require('@iobroker/adapter-core');
const RainBirdCloudCLI = require('./lib/rainbird-cloud-cli');

let adapter;
let cloudController = null;
let controllerData = null;
let polling = null;
let pollingTime = 30000; // 30 seconds default

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'rainbird2',
    });

    adapter = new utils.Adapter(options);

    adapter.on('unload', (callback) => {
        try {
            if (polling) {
                clearTimeout(polling);
                polling = null;
            }
            adapter.setState('info.connection', false, true);
            callback();
        } catch (e) {
            callback();
        }
    });

    adapter.on('stateChange', (id, state) => {
        if (!id || !state || state.ack) {
            return;
        }

        // Remove namespace prefix
        const stateId = id.substring(adapter.namespace.length + 1);
        adapter.log.debug(`State change: ${stateId} = ${state.val}`);

        processStateChange(stateId, state.val);
    });

    adapter.on('ready', () => {
        main();
    });

    return adapter;
}

async function main() {
    try {
        // Get configuration
        const cliPath = adapter.config.cliPath || '~/.openclaw/workspace/skills/rainbird-iq4/iq4-cli';
        pollingTime = adapter.config.pollinterval || 30000;
        
        if (pollingTime < 5000) {
            pollingTime = 5000;
        }

        adapter.log.info(`[START] Rain Bird 2 Adapter (Cloud API)`);
        adapter.log.info(`[START] CLI Path: ${cliPath}`);
        adapter.log.info(`[START] Poll interval: ${pollingTime}ms`);

        // Initialize cloud controller
        cloudController = new RainBirdCloudCLI(cliPath, adapter.log);

        // Check authentication
        const isAuth = await cloudController.isAuthenticated();
        if (!isAuth) {
            adapter.log.error('[ERROR] Not authenticated with Rain Bird Cloud!');
            adapter.log.error('[ERROR] Please run: cd $(dirname ' + cliPath + ') && ./iq4-cli login USERNAME PASSWORD');
            adapter.setState('info.connection', false, true);
            return;
        }

        adapter.log.info('[OK] Authentication valid');

        // Get controllers
        const controllers = await cloudController.getControllers();
        if (controllers.length === 0) {
            adapter.log.error('[ERROR] No controllers found in your Rain Bird account');
            adapter.setState('info.connection', false, true);
            return;
        }

        // Use configured controller ID or first one
        const controllerId = adapter.config.controllerId || controllers[0].id;
        controllerData = controllers.find(c => c.id === controllerId) || controllers[0];

        adapter.log.info(`[OK] Using controller: ${controllerData.name} (ID: ${controllerData.id})`);
        adapter.log.info(`[OK] Type: ${controllerData.isMQTT ? 'MQTT' : 'WiFi'}, Online: ${controllerData.isConnected}`);

        adapter.setState('info.connection', true, true);

        // Subscribe to all states
        adapter.subscribeStates('*');

        // Initialize states
        await initializeStates();

        // Start polling
        pollData();

    } catch (error) {
        adapter.log.error(`[ERROR] Initialization failed: ${error.message}`);
        adapter.log.error(error.stack);
        adapter.setState('info.connection', false, true);
    }
}

async function initializeStates() {
    adapter.log.info('[INIT] Creating states...');

    try {
        // Controller states
        await setStateAsync(
            `controller.${controllerData.id}.online`,
            {
                name: 'Controller online',
                type: 'boolean',
                role: 'indicator.reachable',
                read: true,
                write: false
            },
            controllerData.isConnected
        );

        await setStateAsync(
            `controller.${controllerData.id}.name`,
            {
                name: 'Controller name',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            },
            controllerData.name
        );

        await setStateAsync(
            `controller.${controllerData.id}.rainDelay`,
            {
                name: 'Rain delay (days)',
                type: 'number',
                role: 'value',
                unit: 'days',
                read: true,
                write: false
            },
            controllerData.rainDelay
        );

        // Get stations
        adapter.log.info('[INIT] Loading stations...');
        const stations = await cloudController.getStations(controllerData.id);
        adapter.log.info(`[INIT] Found ${stations.length} stations`);

        for (const station of stations) {
            await setStateAsync(
                `controller.${controllerData.id}.stations.${station.id}.name`,
                {
                    name: 'Station name',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: false
                },
                station.name
            );

            await setStateAsync(
                `controller.${controllerData.id}.stations.${station.id}.terminal`,
                {
                    name: 'Terminal number',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: false
                },
                station.terminal
            );
        }

        // Get programs
        adapter.log.info('[INIT] Loading programs...');
        const programs = await cloudController.getPrograms(controllerData.id);
        adapter.log.info(`[INIT] Found ${programs.length} programs`);

        for (const program of programs) {
            const programDetail = await cloudController.getProgram(program.id);

            await setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.name`,
                {
                    name: 'Program name',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: false
                },
                program.name
            );

            await setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.enabled`,
                {
                    name: 'Program enabled',
                    type: 'boolean',
                    role: 'indicator',
                    read: true,
                    write: false
                },
                program.isEnabled
            );

            await setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.seasonalAdjust`,
                {
                    name: 'Seasonal adjust percentage',
                    type: 'number',
                    role: 'level',
                    unit: '%',
                    min: 0,
                    max: 300,
                    read: true,
                    write: true
                },
                program.programAdjust
            );

            await setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.weekDays`,
                {
                    name: 'Week days (binary: SuMoTuWeThFrSa)',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: true
                },
                program.weekDays
            );

            // Start times
            if (programDetail.startTimes && programDetail.startTimes.length > 0) {
                const startTimesStr = programDetail.startTimes
                    .map(st => st.dateTimeLocal.substring(11, 16))
                    .join(', ');

                await setStateAsync(
                    `controller.${controllerData.id}.programs.${program.id}.startTimes`,
                    {
                        name: 'Start times (read-only)',
                        type: 'string',
                        role: 'text',
                        read: true,
                        write: false
                    },
                    startTimesStr
                );
            }

            // Runtimes
            if (programDetail.runtimes && programDetail.runtimes.length > 0) {
                for (const rt of programDetail.runtimes) {
                    if (rt.runtimes && rt.runtimes.length > 0) {
                        const runtime = rt.runtimes[0];
                        await setStateAsync(
                            `controller.${controllerData.id}.programs.${program.id}.stations.${rt.stationId}.baseRuntime`,
                            {
                                name: 'Base runtime',
                                type: 'string',
                                role: 'text',
                                read: true,
                                write: false
                            },
                            runtime.baseRunTime
                        );

                        await setStateAsync(
                            `controller.${controllerData.id}.programs.${program.id}.stations.${rt.stationId}.adjustedRuntime`,
                            {
                                name: 'Adjusted runtime',
                                type: 'string',
                                role: 'text',
                                read: true,
                                write: false
                            },
                            runtime.adjustedRunTime
                        );
                    }
                }
            }
        }

        adapter.log.info('[INIT] States initialized successfully');

    } catch (error) {
        adapter.log.error(`[INIT] Error initializing states: ${error.message}`);
        throw error;
    }
}

async function pollData() {
    try {
        adapter.log.debug('[POLL] Updating data...');

        // Update controller status
        const controllers = await cloudController.getControllers();
        const currentController = controllers.find(c => c.id === controllerData.id);

        if (currentController) {
            await adapter.setStateAsync(
                `controller.${controllerData.id}.online`,
                currentController.isConnected,
                true
            );

            await adapter.setStateAsync(
                `controller.${controllerData.id}.rainDelay`,
                currentController.rainDelay,
                true
            );
        }

        // Update programs
        const programs = await cloudController.getPrograms(controllerData.id);
        for (const program of programs) {
            await adapter.setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.enabled`,
                program.isEnabled,
                true
            );

            await adapter.setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.seasonalAdjust`,
                program.programAdjust,
                true
            );

            await adapter.setStateAsync(
                `controller.${controllerData.id}.programs.${program.id}.weekDays`,
                program.weekDays,
                true
            );
        }

        adapter.log.debug('[POLL] Update completed');

    } catch (error) {
        adapter.log.error(`[POLL] Error: ${error.message}`);
        
        // Check if token expired
        if (error.message && error.message.includes('401')) {
            adapter.log.error('[POLL] Token expired! Please re-authenticate.');
            adapter.setState('info.connection', false, true);
        }
    }

    // Schedule next poll
    polling = setTimeout(pollData, pollingTime);
}

async function processStateChange(id, value) {
    try {
        adapter.log.debug(`[WRITE] Processing: ${id} = ${value}`);

        // Parse ID structure: controller.ID.programs.PROGRAM_ID.PROPERTY
        const parts = id.split('.');

        if (parts.length < 5) {
            adapter.log.warn(`[WRITE] Invalid state ID: ${id}`);
            return;
        }

        const controllerId = parseInt(parts[1]);
        const programId = parseInt(parts[3]);
        const property = parts[4];

        if (controllerId !== controllerData.id) {
            adapter.log.warn(`[WRITE] Controller ID mismatch: ${controllerId} != ${controllerData.id}`);
            return;
        }

        if (property === 'seasonalAdjust') {
            const percent = parseInt(value);
            
            if (percent < 0 || percent > 300) {
                adapter.log.error(`[WRITE] Invalid seasonal adjust value: ${percent} (must be 0-300)`);
                return;
            }

            adapter.log.info(`[WRITE] Setting seasonal adjust for program ${programId} to ${percent}%`);
            await cloudController.setSeasonalAdjust(programId, percent);
            await adapter.setStateAsync(id, percent, true);
            
            adapter.log.info(`[WRITE] Seasonal adjust updated successfully`);

        } else if (property === 'weekDays') {
            const days = String(value);
            
            if (!/^[01]{7}$/.test(days)) {
                adapter.log.error(`[WRITE] Invalid weekDays format: ${days} (must be 7 binary digits)`);
                return;
            }

            adapter.log.info(`[WRITE] Setting water days for program ${programId} to ${days}`);
            await cloudController.setWaterDays(programId, days);
            await adapter.setStateAsync(id, days, true);
            
            adapter.log.info(`[WRITE] Water days updated successfully`);
        }

    } catch (error) {
        adapter.log.error(`[WRITE] Failed to update state ${id}: ${error.message}`);
    }
}

/**
 * Helper to create/update state with object and value
 */
async function setStateAsync(id, stateObj, value) {
    await adapter.setObjectNotExistsAsync(id, {
        type: 'state',
        common: stateObj,
        native: {}
    });
    
    if (value !== undefined) {
        await adapter.setStateAsync(id, value, true);
    }
}

// Start the adapter
if (require.main !== module) {
    module.exports = startAdapter;
} else {
    startAdapter();
}
