import * as vscode from 'vscode';
import { exec } from 'child_process';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UsbDevice {
    client: string;
    busId: string;
    vendor: string;
    product: string;
    path: string;
    deviceClass: string;
    interfaces: UsbInterface[];
}

interface UsbInterface {
    index: number;
    description: string;
    classCode: string;
}


type ImportedUsbDevice = {
  port: string;
  speed: string;
  vendor: string;
  product: string;
  vendorId: string;
  productId: string;
  remoteUrl: string;
  remoteBus: string;
  remoteDev: string;
};
// -----------------------------------------------------------------------------
// Extension activation
// -----------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('usbipManager.listDevices', listDevices),
        vscode.commands.registerCommand('usbipManager.attachDevice', attachDevice),
        vscode.commands.registerCommand('usbipManager.detachDevice', detachDevice)
    );
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

/**
 * Lists USB/IP devices available on the configured clients and lets the user
 * pick one using VS Code's Quick Pick UI instead of Inquirer.
 */
async function listDevices(): Promise<UsbDevice[] | undefined> {
    const clients: string[] = vscode.workspace
        .getConfiguration('usbipManager')
        .get('clients', []);

    if (clients.length === 0) {
        vscode.window.showErrorMessage('No USB/IP clients configured.');
        return;
    }

    const devices: UsbDevice[] = [];

    for (const client of clients) {
        try {
            const output = (await runCommand(`usbip.exe list -r ${client}`)).trim();
            devices.push(...parseUsbipOutput(output, client));
        } catch (err) {
            // Errors are already surfaced to the user by runCommand; continue so that
            // other clients can still be queried.
        }
    }

    if (devices.length === 0) {
        vscode.window.showWarningMessage('No shareable USB devices found.');
        return;
    }

    const quickPickItems = devices.map(device => ({
        label: `[${device.client}] ${device.busId}`,
        description: `${device.vendor} ${device.product}`,
        detail: `${device.deviceClass} – ${device.path}`,
        device
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select USB device'
    });

    return selected ? [selected.device] : undefined;
}

/**
 * Attaches the device selected via {@link listDevices} to the local host.
 */
async function attachDevice() {
    const devices = await listDevices();
    if (!devices) {
        return;
    }

    for (const device of devices) {
        try {
            await runCommand(`usbip.exe attach -r ${device.client} -b ${device.busId}`);
            vscode.window.showInformationMessage(`Attached ${device.busId} from ${device.client}.`);
        } catch {
            /* Error already shown to user by runCommand */
        }
    }
}

/**
 * Prompts the user for a port number and detaches the corresponding USB/IP
 * device using VS Code's input box UI.
 */
async function detachDevice() {
	const ports = await runCommand('usbip.exe port');
	const portList = parseImportedUsbDevices(ports);
	if (portList.length === 0) {
		vscode.window.showWarningMessage('No USB/IP devices currently attached.');
		return;
	}
	const portItems = portList.map(device => ({
		label: `Port ${device.port}: ${device.vendor} ${device.product}`,
		description: device.remoteUrl,
		device
	}));
	const selected = await vscode.window.showQuickPick(portItems, {
		placeHolder: 'Select USB/IP device to detach'
	});
    if (!selected) {
        return; // User cancelled.
    }

    try {
        await runCommand(`usbip.exe detach -p ${selected.device.port}`);
        vscode.window.showInformationMessage(`Detached device from port ${selected.device.port}.`);
    } catch {
        /* Error already shown to user by runCommand */
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(stderr || error.message);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

function parseUsbipOutput(output: string, client: string): UsbDevice[] {
    const devices: UsbDevice[] = [];
    const lines = output.split(/\r?\n/);
    let currentDevice: UsbDevice | null = null;

    const busLineRegex = /^(\s*)(\S+)\s+:\s+(.*)\s+:\s+(.*)\s+\(([\da-fA-F]{4}:[\da-fA-F]{4})\)/;
    const pathRegex = /^\s*:\s+(\/.*)/;
    const classRegex = /^\s*:\s+\((.*)\)\s+\(([\dA-Fa-f]{2}\/[\dA-Fa-f]{2}\/[\dA-Fa-f]{2})\)/;
    const interfaceRegex = /^\s*:\s+(\d+)\s+-\s+(.*)\s+\(([\dA-Fa-f]{2}\/[\dA-Fa-f]{2}\/[\dA-Fa-f]{2})\)/;

    for (const line of lines) {
        const busMatch = line.match(busLineRegex);
        if (busMatch) {
            if (currentDevice) {
                devices.push(currentDevice);
            }

            currentDevice = {
                client,
                busId: busMatch[2],
                vendor: busMatch[3],
                product: busMatch[4],
                path: '',
                deviceClass: '',
                interfaces: []
            };
            continue;
        }

        const pathMatch = line.match(pathRegex);
        if (pathMatch && currentDevice) {
            currentDevice.path = pathMatch[1];
            continue;
        }

        const classMatch = line.match(classRegex);
        if (classMatch && currentDevice) {
            currentDevice.deviceClass = `${classMatch[1]} (${classMatch[2]})`;
            continue;
        }

        const intfMatch = line.match(interfaceRegex);
        if (intfMatch && currentDevice) {
            currentDevice.interfaces.push({
                index: Number(intfMatch[1]),
                description: intfMatch[2],
                classCode: intfMatch[3]
            });
        }
    }

    if (currentDevice) {
        devices.push(currentDevice);
    }

    return devices;
}


export function parseImportedUsbDevices(output: string): ImportedUsbDevice[] {
  const devices: ImportedUsbDevice[] = [];
  const lines = output.split(/\r?\n/);

  const portLineRegex = /^Port (\d+): device in use at (.+)$/;
  const vendorLineRegex = /^\s+(.*)\s+:\s+(.*)\s+\(([\da-fA-F]{4}):([\da-fA-F]{4})\)/;
  const urlRegex = /^\s+-> usbip:\/\/(.+)/;
  const remoteBusDevRegex = /^\s+-> remote bus\/dev (\d{3})\/(\d{3})/;

  let currentDevice: Partial<ImportedUsbDevice> = {};

  for (const line of lines) {
    const portMatch = line.match(portLineRegex);
    if (portMatch) {
      if (currentDevice.port) {
        devices.push(currentDevice as ImportedUsbDevice);
        currentDevice = {};
      }
      currentDevice.port = portMatch[1].padStart(2, '0');
      currentDevice.speed = portMatch[2];
      continue;
    }

    const vendorMatch = line.match(vendorLineRegex);
    if (vendorMatch) {
      currentDevice.vendor = vendorMatch[1];
      currentDevice.product = vendorMatch[2];
      currentDevice.vendorId = vendorMatch[3];
      currentDevice.productId = vendorMatch[4];
      continue;
    }

    const urlMatch = line.match(urlRegex);
    if (urlMatch) {
      currentDevice.remoteUrl = `usbip://${urlMatch[1]}`;
      continue;
    }

    const busDevMatch = line.match(remoteBusDevRegex);
    if (busDevMatch) {
      currentDevice.remoteBus = busDevMatch[1];
      currentDevice.remoteDev = busDevMatch[2];
    }
  }

  if (currentDevice.port) {
    devices.push(currentDevice as ImportedUsbDevice);
  }

  return devices;
}
// -----------------------------------------------------------------------------
// Deactivation (noop)
// -----------------------------------------------------------------------------

export function deactivate() { /* no‑op */ }
