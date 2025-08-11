import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

// Constants for better maintainability
const INJECTION_CHECK_INTERVAL = 2000; // 2 seconds
const PYTHON_EXECUTION_TIMEOUT = 5000; // 5 seconds
const TEMP_DIR_NAME = 'sciviewer';

export interface InjectionStatus {
    isInjected: boolean;
    environment: string;
    lastInjection: Date | null;
    processId?: number;
    interpreterPath?: string;
}

export class AutoInjectionManager {
    private statusBarItem: vscode.StatusBarItem;
    private injectionStatus: Map<string, InjectionStatus> = new Map();
    private monkeyPatchPath: string;
    private tempDir: string;
    private injectionTimer: NodeJS.Timeout | null = null;
    private isAutoInjectionEnabled: boolean = true;

    constructor(context: vscode.ExtensionContext) {
        this.monkeyPatchPath = path.join(context.extensionPath, 'out', 'assets', 'monkey_patch.py');
        this.tempDir = path.join(os.tmpdir(), TEMP_DIR_NAME);
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'sciviewer.showStatus';
        context.subscriptions.push(this.statusBarItem);

        // Initialize
        this.initializeAutoInjection();
        this.updateStatusBar();
    }

    private initializeAutoInjection(): void {
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Start monitoring for Python activity
        this.startPythonActivityMonitoring();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sciviewer.autoInject')) {
                this.isAutoInjectionEnabled = vscode.workspace.getConfiguration('sciviewer').get('autoInject', true);
                this.updateStatusBar();
            }
        });
    }

    private startPythonActivityMonitoring(): void {
        // Monitor debug sessions
        vscode.debug.onDidStartDebugSession(session => {
            if (session.type === 'python') {
                this.handlePythonDebugSession(session);
            }
        });

        // Monitor terminal execution
        vscode.window.onDidOpenTerminal(terminal => {
            this.monitorTerminalForPython(terminal);
        });

        // Monitor file changes for Python execution
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === 'python') {
                this.handlePythonFileOpen(document);
            }
        });

        // Start periodic injection check
        this.startPeriodicInjectionCheck();
    }

    private async handlePythonDebugSession(session: vscode.DebugSession): Promise<void> {
        if (!this.isAutoInjectionEnabled) return;

        const config = session.configuration;
        const pythonPath = config.python || config.pythonPath || 'python';
        
        try {
            await this.injectIntoDebugSession(session, pythonPath);
            this.updateInjectionStatus(session.id, {
                isInjected: true,
                environment: 'debug',
                lastInjection: new Date(),
                interpreterPath: pythonPath
            });
        } catch (error) {
            console.error('Failed to inject into debug session:', error);
            this.showInjectionError(error as Error);
        }
    }

    private async injectIntoDebugSession(session: vscode.DebugSession, pythonPath: string): Promise<void> {
        // Create injection code for debug session
        const injectionCode = this.generateInjectionCode();
        
        // Execute the injection via debug console
        await session.customRequest('evaluate', {
            expression: injectionCode,
            context: 'repl'
        });
    }

    private monitorTerminalForPython(terminal: vscode.Terminal): void {
        // Note: VS Code doesn't provide direct terminal output monitoring
        // We'll use a smart detection approach based on common patterns
        
        // For now, we'll inject when we detect common Python execution patterns
        // This could be enhanced with terminal extension APIs in the future
    }

    private async handlePythonFileOpen(document: vscode.TextDocument): Promise<void> {
        if (!this.isAutoInjectionEnabled) return;

        const injectionMethod = vscode.workspace.getConfiguration('sciviewer').get('injectionMethod', 'smart') as string;
        
        if (injectionMethod === 'manual') return;
        
        if (injectionMethod === 'smart') {
            // Only inject if the file contains matplotlib-related imports
            const content = document.getText();
            if (!this.containsMatplotlibImports(content)) return;
        }

        // Smart detection of Python environment
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            await this.detectAndInjectIntoEnvironment(workspaceFolder.uri.fsPath);
        }
    }

    private containsMatplotlibImports(content: string): boolean {
        const matplotlibPatterns = [
            /import\s+matplotlib/,
            /from\s+matplotlib/,
            /import\s+pyplot/,
            /plt\./,
            /\.show\(\)/,
            /\.plot\(/,
            /\.figure\(/
        ];
        
        return matplotlibPatterns.some(pattern => pattern.test(content));
    }

    private async detectAndInjectIntoEnvironment(workspacePath: string): Promise<void> {
        try {
            const pythonInterpreter = await this.detectPythonInterpreter(workspacePath);
            if (pythonInterpreter) {
                await this.injectIntoPythonInterpreter(pythonInterpreter, workspacePath);
                
                this.updateInjectionStatus(workspacePath, {
                    isInjected: true,
                    environment: 'workspace',
                    lastInjection: new Date(),
                    interpreterPath: pythonInterpreter
                });
            }
        } catch (error) {
            console.error('Failed to detect and inject into environment:', error);
        }
    }

    private async detectPythonInterpreter(workspacePath: string): Promise<string | null> {
        // Try common Python interpreter locations and patterns
        const pythonCommands = [
            'python3',
            'python',
            path.join(workspacePath, 'venv', 'bin', 'python'),
            path.join(workspacePath, '.venv', 'bin', 'python'),
            path.join(workspacePath, 'env', 'bin', 'python'),
        ];

        for (const cmd of pythonCommands) {
            try {
                const { stdout } = await exec(`${cmd} --version`);
                if (stdout.includes('Python')) {
                    return cmd;
                }
            } catch {
                // Continue to next command
            }
        }

        // Try to use VS Code's Python extension API
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (pythonExtension && pythonExtension.isActive) {
                const pythonApi = pythonExtension.exports;
                if (pythonApi && pythonApi.settings && pythonApi.settings.getExecutionDetails) {
                    const details = await pythonApi.settings.getExecutionDetails();
                    return details.execCommand?.[0] || null;
                }
            }
        } catch {
            // Fallback to default
        }

        return 'python';
    }

    private async injectIntoPythonInterpreter(interpreter: string, workspacePath: string): Promise<void> {
        const injectionCode = this.generateInjectionCode();
        const tempScriptPath = path.join(this.tempDir, 'inject_sciviewer.py');
        
        // Write injection script to temp file
        fs.writeFileSync(tempScriptPath, injectionCode);
        
        // Execute the injection script
        try {
            await exec(`${interpreter} "${tempScriptPath}"`, {
                cwd: workspacePath,
                timeout: PYTHON_EXECUTION_TIMEOUT
            });
        } finally {
            // Clean up temp script
            if (fs.existsSync(tempScriptPath)) {
                fs.unlinkSync(tempScriptPath);
            }
        }
    }

    private generateInjectionCode(): string {
        const monkeyPatchContent = fs.readFileSync(this.monkeyPatchPath, 'utf8');
        
        return `
import sys
import os
import tempfile
from pathlib import Path

# SciViewer Auto-Injection
try:
    # Ensure SciViewer temp directory exists
    sciviewer_temp = os.path.join(tempfile.gettempdir(), '${TEMP_DIR_NAME}')
    os.makedirs(sciviewer_temp, exist_ok=True)
    
    # Monkey patch matplotlib
    ${monkeyPatchContent.replace(/'/g, "\\'")}
    
    print("✅ SciViewer: Auto-injection successful!")
    
except ImportError as e:
    if 'matplotlib' in str(e):
        # matplotlib not installed, create a deferred injection
        def deferred_inject():
            try:
                ${monkeyPatchContent.replace(/'/g, "\\'")}
                print("✅ SciViewer: Deferred injection successful!")
            except Exception as ex:
                print(f"❌ SciViewer: Deferred injection failed: {ex}")
        
        # Hook into matplotlib import
        import sys
        from importlib import import_module
        original_import = __builtins__.__import__
        
        def hooked_import(name, *args, **kwargs):
            module = original_import(name, *args, **kwargs)
            if name in ('matplotlib', 'matplotlib.pyplot'):
                deferred_inject()
            return module
        
        __builtins__.__import__ = hooked_import
        print("📊 SciViewer: Waiting for matplotlib import...")
    else:
        print(f"❌ SciViewer: Injection failed: {e}")
        
except Exception as e:
    print(f"❌ SciViewer: Injection failed: {e}")
`;
    }

    private startPeriodicInjectionCheck(): void {
        this.injectionTimer = setInterval(() => {
            this.checkForNewPlots();
            this.updateStatusBar();
        }, INJECTION_CHECK_INTERVAL);
    }

    private checkForNewPlots(): void {
        if (!fs.existsSync(this.tempDir)) return;

        const files = fs.readdirSync(this.tempDir)
            .filter(file => file.endsWith('.png'))
            .map(file => path.join(this.tempDir, file));

        if (files.length > 0) {
            // Auto-open panel if configured
            const autoOpenPanel = vscode.workspace.getConfiguration('sciviewer').get('autoOpenPanel', true);
            if (autoOpenPanel) {
                vscode.commands.executeCommand('sciviewer.open');
            }
        }
    }

    private updateInjectionStatus(key: string, status: InjectionStatus): void {
        this.injectionStatus.set(key, status);
        this.updateStatusBar();
    }

    private updateStatusBar(): void {
        const showStatusBar = vscode.workspace.getConfiguration('sciviewer').get('showStatusBar', true);
        
        if (!showStatusBar) {
            this.statusBarItem.hide();
            return;
        }

        const activeInjections = Array.from(this.injectionStatus.values())
            .filter(status => status.isInjected).length;

        if (!this.isAutoInjectionEnabled) {
            this.statusBarItem.text = `$(circle-slash) SciViewer: Disabled`;
            this.statusBarItem.tooltip = 'SciViewer auto-injection is disabled. Click to show status.';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (activeInjections > 0) {
            this.statusBarItem.text = `$(check) SciViewer: Active (${activeInjections})`;
            this.statusBarItem.tooltip = `SciViewer is active in ${activeInjections} environment(s). Click to show details.`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            this.statusBarItem.text = `$(search) SciViewer: Monitoring`;
            this.statusBarItem.tooltip = 'SciViewer is monitoring for Python activity. Click to show status.';
            this.statusBarItem.backgroundColor = undefined;
        }

        this.statusBarItem.show();
    }

    private showInjectionError(error: Error): void {
        vscode.window.showWarningMessage(
            `SciViewer injection failed: ${error.message}`,
            'Retry',
            'Disable Auto-Injection'
        ).then(selection => {
            if (selection === 'Retry') {
                this.injectIntoCurrentEnvironment();
            } else if (selection === 'Disable Auto-Injection') {
                vscode.workspace.getConfiguration('sciviewer').update('autoInject', false);
            }
        });
    }

    // Public methods for commands
    public async toggleAutoInjection(): Promise<void> {
        const current = vscode.workspace.getConfiguration('sciviewer').get('autoInject', true);
        await vscode.workspace.getConfiguration('sciviewer').update('autoInject', !current);
        
        vscode.window.showInformationMessage(
            `SciViewer auto-injection ${!current ? 'enabled' : 'disabled'}`
        );
    }

    public async injectIntoCurrentEnvironment(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active Python file found');
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (workspaceFolder) {
            try {
                await this.detectAndInjectIntoEnvironment(workspaceFolder.uri.fsPath);
                vscode.window.showInformationMessage('✅ SciViewer injection successful!');
            } catch (error) {
                this.showInjectionError(error as Error);
            }
        }
    }

    public showStatus(): void {
        const statusItems: string[] = [];
        
        statusItems.push(`**SciViewer Status**\n`);
        statusItems.push(`Auto-injection: ${this.isAutoInjectionEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        statusItems.push(`Active injections: ${this.injectionStatus.size}`);
        statusItems.push(`Temp directory: ${this.tempDir}`);
        statusItems.push(`\n**Active Environments:**`);

        if (this.injectionStatus.size === 0) {
            statusItems.push('No active injections');
        } else {
            for (const [key, status] of this.injectionStatus.entries()) {
                statusItems.push(`• ${key}: ${status.environment} (${status.lastInjection?.toLocaleTimeString()})`);
            }
        }

        vscode.window.showInformationMessage(statusItems.join('\n'), { modal: false });
    }

    public dispose(): void {
        if (this.injectionTimer) {
            clearInterval(this.injectionTimer);
        }
        this.statusBarItem.dispose();
    }
}
