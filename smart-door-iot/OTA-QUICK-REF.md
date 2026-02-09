# 🚀 Quick OTA Reference

## Basic OTA Upload Commands

### PlatformIO - Via IP:
```bash
pio run -t upload --upload-port 10.10.1.5
```

### PlatformIO - Via Hostname:
```bash
pio run -t upload --upload-port smart-door-lock.local
```

### Check ESP32 on Network:
```bash
ping 10.10.1.5
```

### Monitor After OTA:
```bash
pio device monitor
```

## OTA Credentials
- **Hostname**: smart-door-lock
- **IP**: 10.10.1.5
- **Password**: admin
- **Port**: 3232

## Web Dashboard
```
http://10.10.1.5
```

## Troubleshooting
```bash
# Check WiFi connection
pio device monitor

# Upload via USB (fallback)
pio run -t upload

# Reset monitor
Ctrl+C -> pio device monitor
```

## Update platformio.ini for OTA

Add to platformio.ini:
```ini
[env:esp32dev-ota]
extends = env:esp32dev
upload_protocol = espota
upload_port = 10.10.1.5
upload_flags = 
    --auth=admin
```

Then upload:
```bash
pio run -e esp32dev-ota -t upload
```
