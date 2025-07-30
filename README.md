# USB/IP Manager

A Visual Studio Code extension that lets you list, attach, and detach USB/IP devices from one or more remote hosts — directly from the command palette.

---

## ✨ Features

- 🔍 **List available USB/IP devices** from one or multiple remote hosts
- 🔗 **Attach** a selected USB device to your Windows machine
- 🔌 **Detach** devices by port number
- 💾 Define multiple remote clients in VS Code settings
- 🧠 Integrated with VS Code UI — no terminal switching

---

## 🛠 Requirements

- Windows OS
- [`usbip.exe`](https://github.com/vadimgrn/usbip-win2) installed and added to `PATH`
- Remote systems must be running a USB/IP server and have devices exported

---

## ⚙️ Configuration

Add your client IPs in VS Code settings:

1. Open Command Palette → `Preferences: Open Settings (JSON)`
2. Add:

```json
"usbipManager.clients": [
  "192.168.1.100",
  "192.168.1.101"
]
```

## 🚀 Usage

1. Press `Ctrl+Shift+P`
2. Run `USB/IP: List Devices`

   - Choose a device from any remote client

3. Run `USB/IP: Attach Device`

   - Attaches the selected device

4. Run `USB/IP: Detach Device`

   - Input a port number (e.g., 1)

---

## 🧪 Example Output

```text
[192.168.1.100] 1-1 - Logitech USB Optical Mouse
[192.168.1.101] 2-2 - SanDisk USB Flash Drive
```

---

## 📦 Commands

| Command Name            | Description                   |
| ----------------------- | ----------------------------- |
| `USB/IP: List Devices`  | List all exported USB devices |
| `USB/IP: Attach Device` | Attach a selected USB device  |
| `USB/IP: Detach Device` | Detach device by port number  |

---

## 🧑‍💻 Contributing

Feel free to open issues or PRs on [GitHub](https://github.com/yourusername/usbip-manager). Contributions welcome!

---

## 📃 License

MIT License © 2025 Youssef Benhammouda
