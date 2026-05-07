# ioBroker.rainbird2

![Logo](admin/rainbird.png)

**Rain Bird IQ4 Cloud API adapter for ioBroker**

This adapter provides support for Rain Bird irrigation controllers via the **IQ4 Cloud API**, specifically designed for MQTT-enabled controllers like the **ESP-TM2** that don't support the local WiFi API.

## Features

- ✅ Full support for ESP-TM2 and other MQTT controllers
- ✅ Read controller status (online/offline)
- ✅ Read and control programs (schedules)
- ✅ Read stations (zones)
- ✅ Set seasonal adjust per program
- ✅ Modify watering days
- ✅ Add/remove start times (15-minute intervals)
- ✅ Set station runtimes
- ✅ Rain delay monitoring

## Why `rainbird2`?

The original `ioBroker.rainbird` adapter uses the local WiFi API (pyrainbird), which doesn't work with newer MQTT controllers like the ESP-TM2. This adapter uses the **Rain Bird IQ4 Cloud API** instead, providing full support for modern controllers.

## Requirements

1. **Rain Bird 2.0 app** account (not the legacy app)
2. **ESP-TM2** or other MQTT-enabled Rain Bird controller
3. **iq4-cli** binary for authentication ([installation guide](CLOUD_API.md))

## Quick Start

### 1. Install iq4-cli

```bash
cd ~/.openclaw/workspace/skills/rainbird-iq4
go build -o iq4-cli .
```

### 2. Authenticate

```bash
./iq4-cli login YOUR_USERNAME YOUR_PASSWORD
```

This creates a token at `~/.iq4/token` (expires ~2 hours).

### 3. Install Adapter

```bash
npm install iobroker.rainbird2
```

### 4. Configure

1. Enable adapter in ioBroker
2. Set CLI path: `~/.openclaw/workspace/skills/rainbird-iq4/iq4-cli`
3. The adapter will use your stored token automatically

## Important: Start Time Constraints

⚠️ **ESP-TM2 controllers only accept start times in 15-minute intervals!**

- ✅ Valid: 04:00, 04:15, 04:30, 04:45, 05:00, ...
- ❌ Invalid: 04:19, 04:27, 04:55, ...

Other times will be **silently ignored** by the controller.

## States

```
rainbird2.0.controller.ID.online                              (boolean, read)
rainbird2.0.controller.ID.rainDelay                           (number, read)
rainbird2.0.controller.ID.programs.PROGRAM_ID.name           (string, read)
rainbird2.0.controller.ID.programs.PROGRAM_ID.enabled        (boolean, read)
rainbird2.0.controller.ID.programs.PROGRAM_ID.seasonalAdjust (number, read/write)
rainbird2.0.controller.ID.programs.PROGRAM_ID.weekDays       (string, read/write)
rainbird2.0.controller.ID.stations.STATION_ID.name           (string, read)
rainbird2.0.controller.ID.stations.STATION_ID.terminal       (number, read)
```

## Documentation

- [Cloud API Guide](CLOUD_API.md) - Full setup and usage
- [Implementation Status](IMPLEMENTATION_STATUS.md) - Features and roadmap
- [IQ4 API Reference](../skills/rainbird-iq4/docs/IQ4-API.md) - Full API docs

## Limitations

Currently not supported (via cloud API):
- ❌ Manual zone control (use Rain Bird app)
- ❌ Stop irrigation command
- ❌ Run program command
- ❌ Rain sensor state

These features require the local API, which is not available on MQTT controllers.

## Troubleshooting

### Token expired

Re-authenticate:
```bash
cd ~/.openclaw/workspace/skills/rainbird-iq4
./iq4-cli login YOUR_USERNAME YOUR_PASSWORD
```

### Controller not found

- Check that your Rain Bird account has controllers assigned
- Verify controller is online in Rain Bird app
- Ensure you're using Rain Bird 2.0 app credentials (not legacy app)

## Architecture

```
ioBroker Adapter (Node.js)
    ↓
iq4-cli (Go binary)
    ↓
Rain Bird IQ4 Cloud API (HTTPS)
    ↓
Controller (MQTT)
```

## Development

```bash
# Test cloud API
node test_cloud_cli.js

# Run adapter locally
npm start
```

## Credits

- Cloud API implementation based on [rainbird-iq4-cli](https://github.com/nickustinov/rainbird-iq4-cli)
- Original local API adapter: [ioBroker.rainbird](https://github.com/iobroker-community-adapters/ioBroker.rainbird)

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
