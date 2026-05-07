# Rain Bird Cloud API Support (IQ4)

## Overview

This adapter now supports **two modes**:

1. **Local API** (default) - For older controllers with WiFi (RC2, ESP-RZX, etc.)
2. **Cloud API** (new) - For MQTT controllers that only work via Rain Bird IQ4 cloud (ESP-TM2, etc.)

## When to use Cloud API?

Use Cloud API if:
- ✅ You have an **ESP-TM2** or newer MQTT-enabled controller
- ✅ Local API doesn't work (controller shows `isMQTT: true`)
- ✅ You use the **Rain Bird 2.0 app** (not the legacy app)
- ✅ Your controller requires cloud connection to function

Use Local API if:
- ✅ You have an older controller (RC2, ESP-RZX, etc.)
- ✅ Local network control works
- ✅ No cloud dependency desired

## Setup for Cloud API

### Prerequisites

1. **iq4-cli binary** (handles authentication)
   ```bash
   cd /opt/iobroker-companion/rainbird-iq4
   go build -o iq4-cli .
   ```

2. **Authenticate once**
   ```bash
   ./iq4-cli login YOUR_USERNAME YOUR_PASSWORD
   ```
   This creates a token file at `~/.iq4/token` (expires ~2 hours).

### Adapter Configuration

1. Enable "Use Cloud API" in adapter settings
2. Provide path to `iq4-cli` binary (default: `/opt/iobroker-companion/rainbird-iq4/iq4-cli`)
3. The adapter will use the stored token automatically
4. Token refresh is handled automatically

## Features

### Supported via Cloud API

✅ Read controller status (online/offline)  
✅ Read rain delay  
✅ Read programs (schedules)  
✅ Read stations (zones)  
✅ Read/write seasonal adjust per program  
✅ Read/write program days  
✅ Read/write start times  
✅ Read/write station runtimes  
✅ Assign/remove stations from programs  

### Not yet supported via Cloud API

❌ Manual zone control (requires temporary program creation)  
❌ Stop irrigation command  
❌ Run program command  
❌ Advance zone command  
❌ Rain sensor state  

## Important Constraints

### Start Times must be 15-minute intervals

ESP-TM2 controllers **only accept** start times in 15-minute intervals:
- ✅ Valid: 04:00, 04:15, 04:30, 04:45, 05:00, ...
- ❌ Invalid: 04:19, 04:27, 04:55, ...

Other times will be **silently ignored** by the controller!

## State Mappings

### Local API → Cloud API Equivalents

| Feature | Local API | Cloud API |
|---------|-----------|-----------|
| Water budget | Global | Per-program seasonal adjust |
| Rain delay | Direct control | Read from controller status |
| Manual zone | Direct command | Not supported |
| Program run | Program number | Not supported |

## Architecture

```
ioBroker Adapter
    │
    ├── Local Mode
    │   └── pyrainbird (Python bridge)
    │       └── Local controller (HTTP/SIP)
    │
    └── Cloud Mode
        └── iq4-cli (Go binary)
            └── Rain Bird IQ4 Cloud API
                └── Controller (MQTT)
```

## Troubleshooting

### Token expired

If you see authentication errors:
```bash
cd ~/.openclaw/workspace/skills/rainbird-iq4
./iq4-cli login YOUR_USERNAME YOUR_PASSWORD
```

Token expires after ~2 hours. Re-authentication is needed periodically.

### Controller not found

Check that:
1. Your Rain Bird account has controllers assigned
2. You're using the correct credentials for Rain Bird 2.0 app
3. Controller is online in the Rain Bird app

### Manual zone control doesn't work

Cloud API doesn't support direct zone control. Workarounds:
1. Use Rain Bird 2.0 app for manual tests
2. Create a temporary program via cloud API (advanced)
3. Use schedules instead of manual control

## Development

### Testing Cloud API

```bash
node test_cloud_cli.js
```

This will:
1. Check if `iq4-cli` is available
2. Get controllers
3. Get stations
4. Get programs
5. Show program details

### Adding new features

See `lib/rainbird-cloud-cli.js` for CLI wrapper implementation.
See `skills/rainbird-iq4/docs/IQ4-API.md` for full API documentation.

## References

- [Rain Bird IQ4 CLI](https://github.com/nickustinov/rainbird-iq4-cli)
- [IQ4 API Documentation](../skills/rainbird-iq4/docs/IQ4-API.md)
- [pyrainbird library](https://github.com/allenporter/pyrainbird)

## License

MIT (same as parent project)
