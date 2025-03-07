import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';

// Get the system's temporary directory
const tempDir = path.join(os.tmpdir(), 'sciviewer');

// Ensure the directory exists (you can create it if it doesn't exist)
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

const monkeyPatchPath = path.join(__dirname, 'assets/monkey_patch.py');

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('sciviewer.open', async () => {
        const panel = vscode.window.createWebviewPanel(
            'sciViewer',
            'SciViewer',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
				localResourceRoots: [vscode.Uri.file(tempDir), vscode.Uri.file(path.join(__dirname, 'assets'))]
            }
        );

        updateWebviewContent(panel);
        handleWebviewMessages(panel);
    });

    context.subscriptions.push(disposable);
}

function updateWebviewContent(panel: vscode.WebviewPanel) {
    const assetsDir = 'assets';
    const htmlPath = path.join(__dirname, assetsDir, 'webview.html');
    const cssPath = path.join(__dirname, assetsDir, 'webview.css');
    const jsPath = path.join(__dirname, assetsDir, 'webview.js');

    // Convert the paths to webview URIs
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(cssPath));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(jsPath));

    const files = getSortedImages(tempDir);

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    htmlContent = htmlContent
            .replace('${styleUri}', styleUri.toString())
            .replace('${scriptUri}', scriptUri.toString());

    if (files.length > 0) {
        const lastImages = files.slice(0, 10);
        const latestImageUri = panel.webview.asWebviewUri(vscode.Uri.file(files[0]));
        const thumbnailsUris = lastImages.map((file, index) => panel.webview.asWebviewUri(vscode.Uri.file(file)));
        const thumbnails = thumbnailsUris.map((uri, index) => {
            return `<img id="thumbnail-${index}" src="${uri}" 
                class="thumbnail" style="width: 80px; height: auto;" 
                onclick="showImage('${uri}', ${index})">`;
        }).join('');

        // Replace the placeholders in HTML with actual URIs
        htmlContent = htmlContent.replace('${latestImageUri}', latestImageUri.toString())
            .replace('${thumbnails}', thumbnails);

    }
        
    // Set the webview HTML
    panel.webview.html = htmlContent;
    
}

function getSortedImages(dir: string): string[] {
    return fs.readdirSync(dir)
        .filter(file => file.endsWith('.png'))
        .map(file => path.join(dir, file))
        .sort((a, b) => fs.statSync(b).birthtime.getTime() - fs.statSync(a).birthtime.getTime());
}

export function handleWebviewMessages(panel: vscode.WebviewPanel) {
    panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'checkImages') {
            const files = getSortedImages(tempDir);

            if (files.length > 0) {
                const lastImages = files.slice(0, 10);
                const thumbnailsUris = lastImages.map((file, index) => panel.webview.asWebviewUri(vscode.Uri.file(file)).toString());
                panel.webview.postMessage({
                    command: 'updateThumbnails',
                    thumbnailsUris: thumbnailsUris
                });
            }
            else {
                panel.webview.postMessage({
                    command: 'clearThumbnails'
                });
            }
        }

        // Handle deleting image
        if (message.command === 'deleteImage') {
            try {
                const imageUrl = message.imageUrl;
                const filePath = extractFilePathFromWebviewUri(imageUrl);
                
                if (filePath) {
                    fs.unlinkSync(filePath);
                    vscode.window.showInformationMessage('Image deleted successfully');
                    // Trigger a refresh of the thumbnails
                    const files = getSortedImages(tempDir);
                    if (files.length > 0) {
                        const lastImages = files.slice(0, 10);
                        const thumbnailsUris = lastImages.map((file, index) => panel.webview.asWebviewUri(vscode.Uri.file(file)).toString());
                        panel.webview.postMessage({
                            command: 'updateThumbnails',
                            thumbnailsUris: thumbnailsUris
                        });
                    } else {
                        panel.webview.postMessage({
                            command: 'clearThumbnails'
                        });
                    }
                } else {
                    vscode.window.showErrorMessage('Failed to extract image path from URI.');
                }
            } catch (error) {
                console.error('Error deleting image:', error);
                vscode.window.showErrorMessage('Failed to delete image.');
            }
        }

        // Handle the copy button click
        if (message.command === 'copyPythonContent') {
            // Generate a one-liner that imports the monkey_patch.py file using importlib
            const importOneLiner = `import importlib.util; import sys; spec = importlib.util.spec_from_file_location("monkey_patch", r'${monkeyPatchPath.replace(/\\/g, '\\\\')}'); module = importlib.util.module_from_spec(spec); sys.modules["monkey_patch"] = module; spec.loader.exec_module(module)`;
            vscode.env.clipboard.writeText(importOneLiner);
        }

        // Handle copying image to clipboard
        if (message.command === 'copyImageToClipboard') {
            try {
                const imageUrl = message.imageDataUrl;
                const filePath = extractFilePathFromWebviewUri(imageUrl);
                
                if (filePath) {
                    const success = copyImageToClipboardByPlatform(filePath);
                    if (!success) {
                        vscode.window.showErrorMessage('Failed to copy image to clipboard. Platform may not be supported.');
                    }
                } else {
                    vscode.window.showErrorMessage('Failed to extract image path from URI.');
                }
            } catch (error) {
                console.error('Error copying image to clipboard:', error);
                vscode.window.showErrorMessage('Failed to copy image to clipboard.');
            }
        }

        // Handle copying image path
        if (message.command === 'copyImagePath') {
            try {
                const imageUrl = message.imageUrl;
                const filePath = extractFilePathFromWebviewUri(imageUrl);
                
                if (filePath) {
                    vscode.env.clipboard.writeText(filePath);
                } else {
                    vscode.window.showErrorMessage('Failed to extract image path from URI.');
                }
            } catch (error) {
                console.error('Error copying image path:', error);
                vscode.window.showErrorMessage('Failed to copy image path.');
            }
        }

        // Handle downloading image
        if (message.command === 'downloadImage') {
            try {
                const imageUrl = message.imageUrl;
                const filePath = extractFilePathFromWebviewUri(imageUrl);
                
                if (filePath) {
                    const fileName = path.basename(filePath);
                    
                    vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Downloads', fileName)),
                        filters: {
                            'Images': ['png', 'jpg', 'jpeg', 'gif']
                        }
                    }).then(fileUri => {
                        if (fileUri) {
                            fs.copyFileSync(filePath, fileUri.fsPath);
                        }
                    });
                } else {
                    vscode.window.showErrorMessage('Failed to extract image path from URI.');
                }
            } catch (error) {
                console.error('Error downloading image:', error);
                vscode.window.showErrorMessage('Failed to download image.');
            }
        }
    });
}

// Helper function to extract file path from webview URI
function extractFilePathFromWebviewUri(uri: string): string | null {
    try {
        // Parse the URI to get the query parameters
        const url = new URL(uri);
        
        // For VSCode webview URIs, we need to extract the path differently
        if (url.protocol === 'vscode-webview:') {
            // The URI might be in the format vscode-webview://[id]/vscode-resource/[scheme]/[path]
            const pathMatch = uri.match(/vscode-resource:\/\/file\/([^?#]+)/);
            if (pathMatch && pathMatch[1]) {
                return decodeURIComponent(pathMatch[1]);
            }
            
            // For Windows paths with drive letter
            const windowsMatch = uri.match(/vscode-resource:\/\/file\/\/\/([a-zA-Z]:\/[^?#]+)/);
            if (windowsMatch && windowsMatch[1]) {
                return decodeURIComponent(windowsMatch[1]);
            }
            
            // For macOS/Linux paths
            const unixMatch = uri.match(/vscode-resource:\/\/file\/\/([^?#]+)/);
            if (unixMatch && unixMatch[1]) {
                return '/' + decodeURIComponent(unixMatch[1]);
            }
        }
        
        // For direct file URIs
        if (url.protocol === 'file:') {
            return decodeURIComponent(url.pathname);
        }
        
        // If we get here, try to extract from the original tempDir path
        const files = getSortedImages(tempDir);
        const fileName = uri.split('/').pop()?.split('?')[0];
        
        if (fileName) {
            const matchingFile = files.find(file => file.endsWith(fileName));
            if (matchingFile) {
                return matchingFile;
            }
        }
        
        console.log('Could not extract file path from URI:', uri);
        return null;
    } catch (error) {
        console.error('Error extracting file path from URI:', error);
        return null;
    }
}

// Platform-specific image copying
function copyImageToClipboardByPlatform(imagePath: string): boolean {
    const platform = os.platform();
    
    try {
        if (platform === 'darwin') {
            // macOS
            childProcess.execSync(`osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as JPEG picture)'`);
            return true;
        } else if (platform === 'win32') {
            // Windows - using PowerShell
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                $img = [System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, '\\\\')}')
                [System.Windows.Forms.Clipboard]::SetImage($img)
            `;
            childProcess.execSync(`powershell -command "${psScript}"`);
            return true;
        } else if (platform === 'linux') {
            // Linux - using xclip
            childProcess.execSync(`xclip -selection clipboard -t image/png -i "${imagePath}"`);
            return true;
        } else {
            // Fallback for unsupported platforms
            vscode.env.clipboard.writeText(`Image path: ${imagePath}`);
            return false;
        }
    } catch (error) {
        console.error(`Error copying image on ${platform}:`, error);
        // Fallback to copying the path
        vscode.env.clipboard.writeText(`Image path: ${imagePath}`);
        return false;
    }
}
