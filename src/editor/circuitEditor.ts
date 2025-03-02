import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LevelDefinition } from '../levels/types';
import { Level1Template } from '../levels/stage1/level1';
import { CircuitValidator } from '../validators/circuitValidator';

export class CircuitEditorPanel {
    public static currentPanel: CircuitEditorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionPath: string;
    private _disposables: vscode.Disposable[] = [];
    private _currentLevel?: LevelDefinition;

    public loadLevel(level: LevelDefinition) {
        this._currentLevel = level;
        this._panel.title = `NAND Game - ${level.title}`;
        this._updateContent();
    }

    private _updateContent() {
        this._panel.webview.html = this._getWebviewContent();
        if (this._currentLevel) {
            // Send level data to webview
            this._panel.webview.postMessage({
                command: 'loadLevel',
                level: {
                    ...this._currentLevel,
                    template: this._currentLevel.id === 'stage1-level1' ? Level1Template : undefined
                }
            });
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
        this._panel = panel;
        this._extensionPath = extensionPath;

        // Set initial HTML content
        this._updateContent();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'loadLevel':
                        // TODO: Load level data
                        break;
                    case 'validateCircuit':
                        if (this._currentLevel) {
                            const validator = new CircuitValidator(this._currentLevel, message.circuit);
                            const result = await validator.validate();
                            
                            // Send validation result back to webview
                            this._panel.webview.postMessage({
                                command: 'validationResult',
                                result: result
                            });
                            
                            if (result.success) {
                                vscode.window.showInformationMessage(
                                    `回路が正しく動作しています！獲得スター: ${result.details?.stars}つ`
                                );
                            } else {
                                vscode.window.showErrorMessage(result.message);
                            }
                        }
                        break;
                    case 'saveProgress':
                        // TODO: Save user progress
                        break;
                }
            },
            null,
            this._disposables
        );

        // Clean up resources when the panel is closed
        this._panel.onDidDispose(
            () => {
                CircuitEditorPanel.currentPanel = undefined;
                this.dispose();
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionPath: string, level?: LevelDefinition) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CircuitEditorPanel.currentPanel) {
            CircuitEditorPanel.currentPanel._panel.reveal(column);
            if (level) {
                CircuitEditorPanel.currentPanel.loadLevel(level);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'circuitEditor',
            'NAND Game',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionPath, 'media')),
                    vscode.Uri.file(path.join(extensionPath, 'node_modules', 'digitaljs', 'dist')),
                    vscode.Uri.file(path.join(extensionPath, 'dist'))
                ]
            }
        );

        CircuitEditorPanel.currentPanel = new CircuitEditorPanel(panel, extensionPath);
        if (level) {
            CircuitEditorPanel.currentPanel.loadLevel(level);
        }
    }

    private _getWebviewContent(): string {
        // Get paths to resources
        const scriptPathOnDisk = vscode.Uri.file(
            path.join(this._extensionPath, 'node_modules', 'digitaljs', 'dist', 'main.js')
        );
        const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);

        // Get paths to resources
        const webviewPath = vscode.Uri.file(path.join(this._extensionPath, 'dist', 'webview.js'));
        const webviewUri = this._panel.webview.asWebviewUri(webviewPath);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>NAND Game</title>
        </head>
        <body>
            <div id="gate-palette">
                <!-- Gate palette items will be added dynamically -->
                <div class="gate-item" draggable="true" data-gate-type="Nand">NAND</div>
            </div>
            <div id="container">
                <div id="toolbar">
                    <button class="button" id="paletteBtn">Show Gates</button>
                    <button class="button" id="themeBtn">🌓 Theme</button>
                    <button class="button primary" id="validateBtn">Validate Circuit</button>
                    <button class="button" id="resetBtn">Reset</button>
                    <button class="button" id="helpBtn">Help</button>
                </div>
                <div id="circuit-container"></div>
                <div id="level-info">
                    <h2 id="level-title"></h2>
                    <p id="level-description"></p>
                </div>
                <div id="validation-result" style="display: none;">
                    <h3>検証結果</h3>
                    <div id="validation-message"></div>
                    <div id="validation-details">
                        <p>使用ゲート数: <span id="gate-count">0</span></p>
                        <p>ステップ数: <span id="step-count">0</span></p>
                        <p>獲得スター: <span id="stars">0</span>⭐</p>
                    </div>
                </div>
            </div>
            <script src="${webviewUri}"></script>
        </body>
        </html>`;
    }

    public dispose() {
        CircuitEditorPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}