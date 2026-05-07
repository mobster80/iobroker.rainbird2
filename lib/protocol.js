/**
 * Rain Bird protocol encoding and decoding
 * Pure JavaScript implementation of pyrainbird rainbird.py
 */

const {
    RAINBIRD_COMMANDS,
    RAINBIRD_COMMANDS_BY_ID,
    RESERVED_FIELDS
} = require('./commands');

/**
 * Decode a template-based response
 */
function decodeTemplate(data, cmdTemplate) {
    const result = {};
    
    for (const [k, v] of Object.entries(cmdTemplate)) {
        if (typeof v === 'object' && v.position !== undefined && v.length !== undefined) {
            const position = v.position;
            const length = v.length;
            result[k] = parseInt(data.substring(position, position + length), 16);
        }
    }
    
    return result;
}

/**
 * Decode a schedule response (not fully implemented, basic structure)
 */
function decodeSchedule(data, cmdTemplate) {
    if (data.length < 6) {
        return {};
    }
    
    const subcommand = parseInt(data.substring(4, 6), 16);
    const rest = data.substring(6);
    
    if (subcommand === 0) {
        if (rest.length < 8) {
            return {};
        }
        return {
            controllerInfo: {
                stationDelay: parseInt(rest.substring(0, 4), 16),
                rainDelay: parseInt(rest.substring(4, 6), 16),
                rainSensor: parseInt(rest.substring(6, 8), 16)
            }
        };
    }
    
    if ((subcommand & 16) === 16) {
        if (rest.length < 10) {
            return {};
        }
        const program = subcommand & ~16;
        const fields = [];
        for (let i = 0; i < rest.length; i += 2) {
            fields.push(parseInt(rest.substring(i, i + 2), 16));
        }
        return {
            programInfo: {
                program: program,
                daysOfWeekMask: fields[0],
                period: fields[1],
                synchro: fields[2],
                permanentDaysOff: fields[3],
                reserved: fields[4],
                frequency: fields[5]
            }
        };
    }
    
    if ((subcommand & 96) === 96) {
        if (rest.length < 4) {
            return {};
        }
        const program = subcommand & ~96;
        const entries = [];
        for (let i = 0; i < rest.length; i += 4) {
            entries.push(parseInt(rest.substring(i, i + 4), 16));
        }
        return {
            programStartInfo: {
                program: program,
                startTime: entries
            }
        };
    }
    
    if ((subcommand & 128) === 128) {
        if (rest.length < 4) {
            return {};
        }
        const station = subcommand & ~128;
        const durations = [];
        for (let i = 0; i < rest.length; i += 4) {
            durations.push(parseInt(rest.substring(i, i + 4), 16));
        }
        const numPrograms = Math.floor(durations.length / 2);
        return {
            durations: [
                {
                    zone: station * 2,
                    durations: durations.slice(0, numPrograms)
                },
                {
                    zone: station * 2 + 1,
                    durations: durations.slice(numPrograms, 2 * numPrograms)
                }
            ]
        };
    }
    
    return { data: data };
}

/**
 * Decode a queue response
 */
function decodeQueue(data, cmdTemplate) {
    const page = parseInt(data.substring(2, 4), 16);
    const rest = data.substring(4);
    
    if (page === 0) {
        // Currently running program
        if (data.length === 24) {  // TM2 etc
            const runtime = parseInt(data.substring(8, 12), 16);
            let program = parseInt(data.substring(18, 20), 16);
            if (program > 4) {  // Max programs differs by device
                program = 0;
            }
            return {
                program: {
                    seconds: runtime,
                    program: program,
                    zone: parseInt(data.substring(16, 18), 16),
                    active: (runtime > 0)
                }
            };
        }
        if (data.length === 14) {  // me3
            return {
                program: {
                    program: parseInt(rest.substring(0, 2), 16),
                    running: Boolean(parseInt(rest.substring(2, 4), 16)),
                    zonesRemaining: parseInt(rest.substring(4, 6), 16)
                }
            };
        }
        return { data: data };
    }
    
    if (page === 1) {
        const queue = [];
        if (data.length === 70) {  // TM2
            for (let i = 0; i < 11; i++) {
                const base = i * 6;
                const zone = parseInt(data.substring(base + 4, base + 6), 16) & 31;
                const runtime = parseInt(data.substring(base + 6, base + 10), 16);
                if (zone) {
                    queue.push({ zone: zone, seconds: runtime });
                }
            }
        } else {  // ME3
            for (let i = 0; i < 8; i++) {
                const base = i * 8;
                const program = parseInt(data.substring(base + 4, base + 6), 16);
                const zone = parseInt(data.substring(base + 6, base + 8), 16);
                let runtime = parseInt(data.substring(base + 8, base + 12), 16);
                if (runtime > 0) {
                    runtime = ((runtime & 0xFF00) >> 8) | ((runtime & 0xFF) << 8);
                }
                if (zone) {
                    queue.push({ program: program, zone: zone, seconds: runtime });
                }
            }
        }
        return { zones: queue };
    }
    
    if (data.length === 100) {
        const queue = [];
        for (let i = 0; i < 8; i++) {
            const base = i * 12;
            const program = parseInt(data.substring(base + 4, base + 6), 16);
            const zone = parseInt(data.substring(base + 6, base + 8), 16);
            let runtime = parseInt(data.substring(base + 8, base + 12), 16);
            if (runtime > 0) {
                runtime = ((runtime & 0xFF00) >> 8) | ((runtime & 0xFF) << 8);
            }
            if (zone) {
                queue.push({ program: program, zone: zone, seconds: runtime });
            }
        }
        return { zones: queue };
    }
    
    return { data: data };
}

const DECODERS = {
    decode_template: decodeTemplate,
    decode_schedule: decodeSchedule,
    decode_queue: decodeQueue
};

/**
 * Decode a Rain Bird response
 */
function decode(data) {
    const commandCode = data.substring(0, 2);
    const cmdTemplate = RAINBIRD_COMMANDS_BY_ID[commandCode];
    
    if (!cmdTemplate) {
        console.warn(`Unrecognized server response code '${commandCode}' from '${data}'`);
        return { data: data };
    }
    
    const decoderName = cmdTemplate.decoder || 'decode_template';
    const decoder = DECODERS[decoderName];
    
    return {
        type: cmdTemplate.type,
        ...decoder(data, cmdTemplate)
    };
}

/**
 * Encode a Rain Bird command
 */
function encode(command, ...args) {
    const commandSet = RAINBIRD_COMMANDS[command];
    
    if (!commandSet) {
        throw new Error(
            `Command ${command} not available. Supported: ${Object.keys(RAINBIRD_COMMANDS).join(', ')}`
        );
    }
    
    return encodeCommand(commandSet, ...args);
}

/**
 * Encode a command from a command set
 */
function encodeCommand(commandSet, ...args) {
    const cmdCode = commandSet.command;
    const length = commandSet.length;
    
    if (!length) {
        throw new Error(`Unable to encode command missing length: ${JSON.stringify(commandSet)}`);
    }
    
    if (args.length > length) {
        throw new Error(`Too many parameters. ${length} expected: ${JSON.stringify(commandSet)}`);
    }
    
    // Old style encoding for simple commands
    if (length === 1 || commandSet.parameter !== undefined || commandSet.parameterOne !== undefined) {
        let result = cmdCode;
        
        // Add arguments with proper formatting based on length
        if (commandSet.parameterOne !== undefined && commandSet.parameterTwo !== undefined) {
            // 4-byte command with two 2-byte parameters
            const zone = args[0] || 0;
            const duration = args[1] || 0;
            result += zone.toString(16).toUpperCase().padStart(2, '0');
            result += duration.toString(16).toUpperCase().padStart(4, '0');
        } else {
            // Standard parameter encoding
            for (let i = 0; i < args.length; i++) {
                const value = parseInt(args[i]);
                const hexValue = value.toString(16).toUpperCase().padStart(2, '0');
                result += hexValue;
            }
        }
        
        // Pad to required length
        while (result.length < length * 2) {
            result += '00';
        }
        
        return result;
    }
    
    // New style encoding with positioned parameters
    let data = cmdCode + '00'.repeat(length - 1);
    const argsList = [...args];
    
    for (const key of Object.keys(commandSet)) {
        if (RESERVED_FIELDS.includes(key)) {
            continue;
        }
        
        const commandArg = commandSet[key];
        if (typeof commandArg !== 'object' || !commandArg.position || !commandArg.length) {
            continue;
        }
        
        if (argsList.length === 0) {
            break;
        }
        
        const commandArgLength = commandArg.length;
        let arg = argsList.shift();
        
        if (typeof arg === 'string') {
            arg = parseInt(arg, 16);
        }
        
        const paramTemplate = arg.toString(16).toUpperCase().padStart(commandArgLength, '0');
        const start = commandArg.position;
        const end = start + commandArgLength;
        
        data = data.substring(0, start) + paramTemplate + data.substring(end);
    }
    
    return data;
}

module.exports = {
    encode,
    encodeCommand,
    decode,
    decodeTemplate,
    decodeSchedule,
    decodeQueue
};
