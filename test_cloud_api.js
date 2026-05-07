/**
 * Test script for Rain Bird Cloud API
 * 
 * Usage: node test_cloud_api.js <username> <password>
 */

'use strict';

const RainBirdCloudAPI = require('./lib/rainbird-cloud');

async function test() {
    const username = process.argv[2];
    const password = process.argv[3];
    
    if (!username || !password) {
        console.error('Usage: node test_cloud_api.js <username> <password>');
        process.exit(1);
    }
    
    const api = new RainBirdCloudAPI(username, password, console);
    
    try {
        console.log('=== Testing Rain Bird Cloud API ===\n');
        
        // Test 1: Authentication
        console.log('1. Authenticating...');
        await api.authenticate();
        console.log('✅ Authentication successful\n');
        
        // Test 2: Get controllers
        console.log('2. Getting controllers...');
        const controllers = await api.getControllers();
        console.log(`✅ Found ${controllers.length} controller(s):`);
        controllers.forEach(c => {
            console.log(`   - ${c.name} (ID: ${c.id}, Online: ${c.isConnected})`);
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
            console.log(`   - ${p.name} (ID: ${p.id}, Enabled: ${p.isEnabled}, Days: ${p.weekDays}, Seasonal: ${p.programAdjust}%)`);
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
            
            console.log(`   - Runtimes: ${programDetail.runtimes ? programDetail.runtimes.length : 0} station(s)`);
            
            if (programDetail.runtimes) {
                programDetail.runtimes.forEach(rt => {
                    const stationName = programDetail.stations[rt.stationId] || `Station ${rt.stationId}`;
                    if (rt.runtimes && rt.runtimes.length > 0) {
                        const runtime = rt.runtimes[0];
                        console.log(`     - ${stationName}: ${runtime.baseRunTime} (adjusted: ${runtime.adjustedRunTime})`);
                    }
                });
            }
            console.log('');
        }
        
        // Test 6: Get runtimes
        console.log('6. Getting runtimes for all stations...');
        const runtimes = await api.getRuntimes(controllerId);
        console.log(`✅ Runtime assignments:`);
        runtimes.forEach(rt => {
            console.log(`   - ${rt.stationName}: ${rt.runtimes.length} program(s)`);
            rt.runtimes.forEach(r => {
                console.log(`     - Program ${r.programShortName}: ${r.baseRunTime} base, ${r.adjustedRunTime} adjusted`);
            });
        });
        console.log('');
        
        console.log('=== All tests completed successfully! ===');
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        if (error.response) {
            console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
            if (error.response.data) {
                console.error(`   Response:`, error.response.data);
            }
        }
        process.exit(1);
    }
}

test();
