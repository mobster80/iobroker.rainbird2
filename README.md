# ioBroker.rainbird2

![Logo](admin/rainbird.png)

**Rain Bird IQ4 Cloud API adapter for ioBroker**

Native support for MQTT-enabled Rain Bird controllers (ESP-TM2) via the IQ4 Cloud API.

## Features

- ✅ **Full ESP-TM2 support** (and other MQTT controllers)
- ✅ Controller status (online/offline, rain delay)
- ✅ Program management (read schedules, seasonal adjust, water days)
- ✅ Station information
- ✅ Runtime monitoring (base + adjusted)
- ✅ **Write operations:** Change seasonal adjust and water days
- ✅ Simple setup - no local API configuration needed

## Why rainbird2?

The original `ioBroker.rainbird` uses the local WiFi API which **doesn't work** with MQTT controllers like the ESP-TM2. This adapter uses the **Rain Bird IQ4 Cloud API** exclusively, providing full support for modern controllers.

## Requirements

1. **Rain Bird 2.0 app** account (not the legacy app)
2. **ESP-TM2** or other MQTT-enabled controller
3. **iq4-cli** binary ([installation below](#installation))
4. **Go 1.21+** (to build iq4-cli)

## Installation

### 1. Install iq4-cli

```bash
# Create directory
mkdir -p ~/.openclaw/workspace/skills/rainbird-iq4
cd ~/.openclaw/workspace/skills/rainbird-iq4

# Clone or download iq4-cli source
git clone https://github.com/nickustinov/rainbird-iq4-cli.git .

# Build
go build -o iq4-cli .
```

### 2. Authenticate

```bash
./iq4-cli login YOUR_RAIN_BIRD_USERNAME YOUR_RAIN_BIRD_PASSWORD
```

This creates a token at `~/.iq4/token` (valid ~2 hours).

### 3. Install Adapter

Via ioBroker Admin UI or:

```bash
cd /opt/iobroker
npm install iobroker.rainbird2
```

### 4. Configure

1. Open adapter settings in ioBroker Admin
2. Set CLI path (default: `~/.openclaw/workspace/skills/rainbird-iq4/iq4-cli`)
3. Leave Controller ID empty for auto-detect
4. Set poll interval (default: 30000ms)
5. Save and start adapter

## Important Constraints

⚠️ **Start times must be 15-minute intervals!**

ESP-TM2 controllers **only accept**:
- ✅ Valid: 04:00, 04:15, 04:30, 04:45, 05:00, ...
- ❌ Invalid: 04:19, 04:27, 04:55, ...

Other times will be **silently ignored** by the controller!

## States

### Controller

```
rainbird2.0.controller.ID.online           (boolean, read-only)
rainbird2.0.controller.ID.name             (string, read-only)
rainbird2.0.controller.ID.rainDelay        (number, read-only, days)
```

### Stations

```
rainbird2.0.controller.ID.stations.STATION_ID.name      (string, read-only)
rainbird2.0.controller.ID.stations.STATION_ID.terminal  (number, read-only)
```

### Programs

```
rainbird2.0.controller.ID.programs.PROGRAM_ID.name            (string, read-only)
rainbird2.0.controller.ID.programs.PROGRAM_ID.enabled         (boolean, read-only)
rainbird2.0.controller.ID.programs.PROGRAM_ID.seasonalAdjust  (number, read/write, 0-300%)
rainbird2.0.controller.ID.programs.PROGRAM_ID.weekDays        (string, read/write, binary)
rainbird2.0.controller.ID.programs.PROGRAM_ID.startTimes      (string, read-only)
```

#### weekDays Format

Binary string representing Sun-Sat: `1010100`
- Position 0 = Sunday
- Position 1 = Monday
- ...
- Position 6 = Saturday

Examples:
- `1111111` = Every day
- `0101010` = Mon/Wed/Fri
- `1000001` = Sun/Sat only

## Examples

### Set Seasonal Adjust

```javascript
setState('rainbird2.0.controller.440450.programs.2485327.seasonalAdjust', 75);
```

### Change Water Days to Mon/Thu

```javascript
setState('rainbird2.0.controller.440450.programs.2485327.weekDays', '0101000');
```

## Troubleshooting

### Token Expired

If logs show authentication errors:

```bash
cd ~/.openclaw/workspace/skills/rainbird-iq4
./iq4-cli login YOUR_USERNAME YOUR_PASSWORD
```

Then restart the adapter.

### Controller Not Found

Check:
1. Your Rain Bird account has controllers in the Rain Bird 2.0 app
2. Controller is online in the app
3. You're using Rain Bird 2.0 credentials (not legacy app)

### Adapter Won't Start

Check logs:
```bash
iobroker logs rainbird2
```

Common issues:
- iq4-cli not found (check path in settings)
- Not authenticated (run login command)
- Token expired (re-authenticate)

## Limitations

Cloud API does **not** support:
- ❌ Manual zone control (use Rain Bird app)
- ❌ Stop irrigation command
- ❌ Run program command  
- ❌ Rain sensor state
- ❌ Advance zone

These features require local API which MQTT controllers don't provide.

## Documentation

- [Cloud API Guide](CLOUD_API.md) - Detailed usage
- [Implementation Status](IMPLEMENTATION_STATUS.md) - Features & roadmap
- [Integration Guide](INTEGRATION_GUIDE.md) - Development guide

## Credits

- Cloud API based on [rainbird-iq4-cli](https://github.com/nickustinov/rainbird-iq4-cli)
- Inspired by [ioBroker.rainbird](https://github.com/iobroker-community-adapters/ioBroker.rainbird)

## License

MIT License

Copyright (c) 2026 Michael Obster

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
