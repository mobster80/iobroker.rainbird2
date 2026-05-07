# Changelog

## 1.0.0 (2026-05-07)

### 🎉 Initial Release

Complete rewrite as **Cloud-only adapter** for Rain Bird IQ4 Cloud API.

### Features

- ✅ **Full ESP-TM2 support** (MQTT controllers)
- ✅ Controller status monitoring (online/offline, rain delay)
- ✅ Program management
  - Read programs with schedules
  - Seasonal adjust control (0-300%)
  - Water days configuration (binary format)
- ✅ Station information (name, terminal)
- ✅ Runtime monitoring (base + adjusted)
- ✅ Automatic polling (configurable interval, default 30s)
- ✅ Token expiry detection with helpful error messages

### Breaking Changes

🚨 **Complete departure from original ioBroker.rainbird adapter:**

- ❌ **Removed all local API support** (pyrainbird, native JS)
- ❌ No Python dependencies
- ❌ No local WiFi connectivity
- ✅ **Cloud API only** via iq4-cli bridge
- ✅ Designed exclusively for **MQTT controllers** (ESP-TM2)

### Requirements

1. Rain Bird 2.0 app account (not legacy app)
2. ESP-TM2 or other MQTT-enabled controller
3. iq4-cli binary (Go 1.21+)
4. Node.js 20+
5. ioBroker js-controller 6+
6. ioBroker admin 7+

### Important Constraints

⚠️ **ESP-TM2 controllers only accept start times in 15-minute intervals** (:00, :15, :30, :45)

Other times will be silently ignored by the controller firmware.

### Technical Details

**Architecture:**
```
ioBroker Adapter (Node.js)
    ↓
iq4-cli (Go binary)
    ↓
Rain Bird IQ4 Cloud API
    ↓
ESP-TM2 Controller (MQTT)
```

**Removed files:**
- All pyrainbird Python integration
- Native JavaScript local API implementation
- Unified local/cloud wrapper
- 5000+ lines of legacy code

**New implementation:**
- Clean Cloud-only adapter (~400 lines)
- Direct iq4-cli integration
- Modern async/await patterns
- Comprehensive error handling

### Installation

```bash
# Install iq4-cli
mkdir -p ~/.openclaw/workspace/skills/rainbird-iq4
cd ~/.openclaw/workspace/skills/rainbird-iq4
git clone https://github.com/nickustinov/rainbird-iq4-cli.git .
go build -o iq4-cli .

# Authenticate
./iq4-cli login YOUR_USERNAME YOUR_PASSWORD

# Install adapter
cd /opt/iobroker
npm install iobroker.rainbird2
```

### Credits

- Cloud API based on [rainbird-iq4-cli](https://github.com/nickustinov/rainbird-iq4-cli) by @nickustinov
- Inspired by [ioBroker.rainbird](https://github.com/iobroker-community-adapters/ioBroker.rainbird)

### Author

Michael Obster <michael@obster.org>

### License

MIT
