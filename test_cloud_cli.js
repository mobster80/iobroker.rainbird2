/**
 * Test script for Rain Bird Cloud API via CLI bridge
 */

'use strict';

const RainBirdCloudCLI = require('./lib/rainbird-cloud-cli');

async function test() {
    const cliPath = process.argv[2] || '~/.openclaw/workspace/skills/rainbird-iq4/iq4-cli';
    
    const api = new RainBirdCloudCLI(cliPath, console);
    
    try {
        console.log('=== Testing Rain Bird Cloud API (CLI Bridge) ===\n');
        console.log(`CLI path: ${cliPath}\n`);
        
        // Test 1: Check authentication
        console.log('1. Checking authentication...');
        const isAuth = await api.isAuthenticated();
        
        if (!isAuth) {
            console.error('❌ Not authenticated!');
            console.error('Please run:');
            console.error(`  cd $(dirname ${cliPath})`);
            console.error(`  ./iq4-cli login YOUR_USERNAME YOUR_PASSWORD`);
            process.exit(1);
        }
        console.log('✅ Authenticated\n');
        
        // Test 2: Get controllers
        console.log('2. Getting controllers...');
        const controllers = await api.getControllers();
        console.log(`✅ Found ${controllers.length} controller(s):`);
        controllers.forEach(c => {
            console.log(`   - ${c.name} (ID: ${c.id}, Online: ${c.isConnected}, MQTT: ${c.isMQTT})`);
        });
        console.log('');
        
        if (controllers.length === 0) {
            console.log('No controllers found. Exiting.');
            return;
        }
        
        const controllerId = controllers[0].id;
        console.log(`Using controller: ${controllers[0].name} (ID: ${controllerId})\n`);
        
        // Test 3: Get stations
        console.log('3. Getting stations...');
        const stations = await api.getStations(controllerId);
        console.log(`✅ Found ${stations.length} station(s):`);
        stations.forEach(s => {
            console.log(`   - Terminal ${s.terminal}: ${s.name} (ID: ${s.id})`);
        });
        console.log('');
        
        // Test 4: Get programs
        console.log('4. Getting programs...');
        const programs = await api.getPrograms(controllerId);
        console.log(`✅ Found ${programs.length} program(s):`);
        programs.forEach(p => {
            console.log(`   - ${p.name} (ID: ${p.id}, Days: ${p.weekDays}, Seasonal: ${p.programAdjust}%)`);
        });
        console.log('');
        
        // Test 5: Get program detail
        if (programs.length > 0) {
            const programId = programs[0].id;
            console.log(`5. Getting detail for program ${programs[0].name}...`);
            const programDetail = await api.getProgram(programId);
            
            console.log(`✅ Program detail:`);
            console.log(`   - Week days: ${programDetail.program.weekDays}`);
            console.log(`   - Seasonal adjust: ${programDetail.program.programAdjust}%`);
            console.log(`   - Start times: ${programDetail.startTimes ? programDetail.startTimes.length : 0}`);
            
            if (programDetail.startTimes && programDetail.startTimes.length > 0) {
                programDetail.startTimes.forEach(st => {
                    console.log(`     - ${st.dateTimeLocal.substring(11, 16)} (ID: ${st.id})`);
                });
            }
            
            console.log(`   - Stations: ${programDetail.runtimes ? programDetail.runtimes.length : 0}`);
            
            if (programDetail.runtimes) {
                programDetail.runtimes.forEach(rt => {
                    const stationName = programDetail.stations[rt.stationId] || `Station ${rt.stationId}`;
                    if (rt.runtimes && rt.runtimes.length > 0) {
                        const runtime = rt.runtimes[0];
                        console.log(`     - ${stationName}: ${runtime.baseRunTime} base, ${runtime.adjustedRunTime} adjusted`);
                    }
                });
            }
            console.log('');
        }
        
        console.log('=== All tests completed successfully! ===');
        console.log('\n📝 Next steps:');
        console.log('   1. Configure adapter to use Cloud API mode');
        console.log('   2. Set CLI path in adapter settings');
        console.log('   3. Restart adapter');
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
