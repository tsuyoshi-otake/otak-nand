import './styles.css';
import * as Joint from 'jointjs';

interface CircuitData {
    devices: {
        [key: string]: {
            type: string;
            label?: string;
            bits?: number;
        };
    };
    connectors: {
        from: {
            id: string;
            port: string;
        };
        to: {
            id: string;
            port: string;
        };
    }[];
}

interface TestCase {
    input: number[];
    output: number[];
}

interface LevelRequirements {
    inputs: number;
    outputs: number;
    testCases: TestCase[];
}

interface LevelData {
    title: string;
    description: string;
    template?: CircuitData;
    requirements: LevelRequirements;
}

interface ValidationResult {
    success: boolean;
    message: string;
    details?: {
        gateCount: number;
        stepCount: number;
        stars: number;
        failedTests?: Array<{
            input: number[];
            expected: number[];
            actual: number[];
        }>;
    };
}

interface WebViewMessage {
    command: string;
    level?: LevelData;
    circuit?: CircuitData;
    result?: ValidationResult;
}

// Declare vscode api
declare const vscode: {
    postMessage: (message: any) => void;
};

interface CircuitStyle {
    background: string;
    stroke: string;
    fill: string;
    text: string;
    gate_fill: string;
    gate_stroke: string;
}

class CircuitEditor {
    private paper!: any; // TODO: Fix JointJS typing
    private graph!: Joint.dia.Graph;
    private circuit?: Joint.dia.Graph;
    private _currentLevel?: LevelData;
    private currentStyle: CircuitStyle;

    constructor() {
        const theme = localStorage.getItem('theme') || 'dark';
        this.currentStyle = this.getCircuitStyleForTheme(theme);
        this.initializeUI();
        this.setupEventListeners();
    }

    private updateCircuitStyle(style: CircuitStyle): void {
        // 背景色の更新
        this.paper.drawBackground({ color: style.background });

        // 既存の要素のスタイル更新
        this.graph.getElements().forEach(element => {
            element.attr({
                body: {
                    fill: style.fill,
                    stroke: style.stroke
                },
                label: {
                    fill: style.text
                },
                circle: {
                    fill: style.fill,
                    stroke: style.stroke
                }
            });
        });

        // リンクのスタイル更新
        this.graph.getLinks().forEach(link => {
            link.attr('line/stroke', style.stroke);
        });

        // ゲートパレットのスタイル更新
        const gateItems = document.querySelectorAll('.gate-item');
        gateItems.forEach(item => {
            if (item instanceof HTMLElement) {
                item.style.backgroundColor = style.fill;
                item.style.color = style.text;
                item.style.borderColor = style.stroke;
            }
        });
    }


    private initializeUI(): void {
        const container = document.getElementById('circuit-container');
        if (!container) {
            return;
        }

        /* Initialize JointJS paper and graph */
        this.graph = new Joint.dia.Graph();

        // VSCodeのテーマを取得（デフォルトはダーク）
        const savedTheme = localStorage.getItem('theme') || 'dark';
        const initialStyle = this.getCircuitStyleForTheme(savedTheme);

        this.paper = new Joint.dia.Paper({
            el: container,
            model: this.graph,
            width: container.clientWidth,
            height: container.clientHeight,
            gridSize: 10,
            drawGrid: true,
            background: { color: initialStyle.background }
        });

        // リサイズイベントのハンドリング
        window.addEventListener('resize', () => {
            if (container) {
                this.paper.setDimensions(container.clientWidth, container.clientHeight);
                this.paper.drawGrid();

                // 入力/出力ピンの位置を再計算
                const startY = 120;
                let inputY = startY;
                let outputY = startY;
                
                this.graph.getElements().forEach((element: any) => {
                    const elementType = element.get('type');
                    if (elementType === 'standard.Circle') {
                        const label = element.attr('label/text');
                        if (label === 'IN') {
                            element.position(20, inputY);
                            inputY += 60;
                        } else if (label === 'OUT') {
                            element.position(window.innerWidth - 320, outputY);
                            outputY += 60;
                        }
                    }
                });
            }
        });

        // 初回描画時にもサイズを設定
        setTimeout(() => {
            if (container) {
                this.paper.setDimensions(container.clientWidth, container.clientHeight);
                this.paper.drawGrid();
            }
        }, 0);

        // 初期テーマスタイルを適用
        this.updateCircuitStyle(initialStyle);
    }

    private setupEventListeners(): void {
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data as WebViewMessage;
            switch (message.command) {
                case 'loadLevel': {
                    if (message.level) {
                        this.loadLevel(message.level);
                    }
                    break;
                }
                case 'validationResult': {
                    if (message.result) {
                        this.showValidationResult(message.result);
                    }
                    break;
                }
            }
        });

        // Handle UI events
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                console.log('Validate button clicked');
                const circuit = this.getCircuitData();
                console.log('Circuit data:', circuit);
                vscode.postMessage({
                    command: 'validateCircuit',
                    circuit
                });
                console.log('Validation request sent');
            });
        }

        // Theme toggle button
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            // ローカルストレージからテーマを取得
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.classList.add(`theme-${savedTheme}`);
            themeBtn.textContent = savedTheme === 'dark' ? 'Dark' : 'Light';

            // 初期テーマスタイルを適用
            this.updateCircuitStyle(this.getCircuitStyleForTheme(savedTheme));

            themeBtn.addEventListener('click', () => {
                const newTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
                this.setTheme(newTheme, themeBtn);
            });

            // VSCodeのテーマ変更を監視
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.type === 'vscode-theme-update') {
                    const newTheme = message.value === 'vs-dark' ? 'dark' : 'light';
                    this.setTheme(newTheme, themeBtn);
                }
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetCircuit();
            });
        }

    }

    private loadLevel(level: LevelData): void {
        // Clear existing circuit
        this.graph.clear();

        // Load template if provided
        if (level.template) {
            this.loadCircuit(level.template);
        }

        // Update UI with level information
        const levelInfo = document.getElementById('level-info');
        if (levelInfo) {
            // 既存の内容をクリア
            levelInfo.innerHTML = '';

            // ヘッダー部分を作成
            const header = document.createElement('div');
            header.className = 'level-info-header';
            
            const title = document.createElement('div');
            title.id = 'level-title';
            title.textContent = level.title;
            
            const minimizeBtn = document.createElement('div');
            minimizeBtn.className = 'minimize-button';
            minimizeBtn.innerHTML = '▼';
            
            header.appendChild(title);
            header.appendChild(minimizeBtn);

            // コンテンツ部分を作成
            const content = document.createElement('div');
            content.className = 'level-info-content';
            
            const description = document.createElement('div');
            description.id = 'level-description';
            description.textContent = level.description;
            
            content.appendChild(description);

            // 要素を追加
            levelInfo.appendChild(header);
            levelInfo.appendChild(content);

            // 最小化機能を実装
            header.addEventListener('click', () => {
                levelInfo.classList.toggle('minimized');
                minimizeBtn.innerHTML = levelInfo.classList.contains('minimized') ? '▼' : '▲';
            });
        }

        // Initialize gate palette
        this.initializeGatePalette();
    }

    private initializeGatePalette(): void {
        const palette = document.getElementById('gate-palette');
        if (!palette) {
            return;
        }

        // Clear existing items
        palette.innerHTML = '';

        // Add available gates
        const gates = [
            { type: 'Nand', label: 'NAND' }
        ];

        gates.forEach(gate => {
            const gateEl = document.createElement('div');
            gateEl.className = 'gate-item';
            gateEl.textContent = gate.label;
            gateEl.setAttribute('data-gate-type', gate.type);
            
            gateEl.draggable = true;
            gateEl.addEventListener('dragstart', (e: DragEvent) => {
                e.dataTransfer?.setData('gateType', gate.type);
            });
            
            palette.appendChild(gateEl);
        });

        // Setup drop zone
        this.paper.el.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
        });

        this.paper.el.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            const gateType = e.dataTransfer?.getData('gateType');
            if (gateType) {
                const rect = this.paper.el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const device = this.createDevice(`${gateType.toLowerCase()}_${Date.now()}`, {
                    type: gateType,
                    label: gateType
                });
                
                device.position(x - 30, y - 20); // 中心に配置されるように調整
                this.graph.addCell(device);
            }
        });
    }

    private loadCircuit(circuitData: CircuitData): void {
        const startY = 120; // ツールバーの下から開始
        let inputY = startY;
        let outputY = startY;

        // 入力/出力デバイスを先に取り出して数を数える
        const inputs = Object.entries(circuitData.devices).filter(([_, d]) => d.type === 'Input');
        const outputs = Object.entries(circuitData.devices).filter(([_, d]) => d.type === 'Output');

        // ピン間の間隔を計算（最小60px）
        const spacing = Math.max(60, (window.innerHeight - startY - 100) / Math.max(inputs.length, outputs.length));

        // Create devices
        Object.entries(circuitData.devices).forEach(([id, device]) => {
            const element = this.createDevice(id, device);
            
            if (device.type === 'Input') {
                element.position(20, inputY);
                inputY += spacing;
            } else if (device.type === 'Output') {
                element.position(window.innerWidth - 320, outputY); // Level Infoの左側に配置
                outputY += spacing;
            }
            
            this.graph.addCell(element);
        });

        // Create connections
        circuitData.connectors.forEach(connector => {
            const link = this.createConnection(connector);
            this.graph.addCell(link);
        });
    }

    private createDevice(id: string, device: { type: string; label?: string }): Joint.dia.Element {
        // Create JointJS element based on device type
        switch (device.type) {
            case 'Nand':
                return this.createNandGate(id, device.label);
            case 'Input':
                return this.createInputPin(id, device.label);
            case 'Output':
                return this.createOutputPin(id, device.label);
            default:
                return this.createGenericGate(id, device);
        }
    }

    private createNandGate(id: string, label?: string): Joint.dia.Element {
        const gate = new Joint.shapes.standard.Path({
            id: id,
            position: { x: 100, y: 100 },
            size: { width: 60, height: 40 },
            attrs: {
                body: {
                    // NANDゲートの図形パス
                    d: 'M 0 0 L 0 40 L 40 40 A 20 20 0 0 0 40 0 L 0 0 Z',
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_fill,
                    stroke: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_stroke,
                    strokeWidth: 2
                },
                // 否定を表す小円
                circle: {
                    r: 5,
                    cx: 65,
                    cy: 20,
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_fill,
                    stroke: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_stroke,
                    strokeWidth: 2
                },
                label: {
                    text: label || 'NAND',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                    x: 20,
                    y: 20,
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').text
                }
            },
            ports: {
                groups: {
                    in: {
                        position: { name: 'absolute' },
                        attrs: {
                            circle: {
                                r: 4,
                                magnet: 'passive',
                                fill: this.currentStyle.gate_fill,
                                stroke: this.currentStyle.gate_stroke,
                                strokeWidth: 2
                            },
                            text: {
                                fontSize: 10,
                                fill: this.currentStyle.text
                            }
                        },
                        label: {
                            position: 'left',
                            markup: '<text/>'
                        }
                    },
                    out: {
                        position: { name: 'absolute' },
                        attrs: {
                            circle: {
                                r: 4,
                                magnet: true,
                                fill: this.currentStyle.gate_fill,
                                stroke: this.currentStyle.gate_stroke,
                                strokeWidth: 2
                            },
                            text: {
                                fontSize: 10,
                                fill: this.currentStyle.text
                            }
                        },
                        label: {
                            position: 'right',
                            markup: '<text/>'
                        }
                    }
                },
                items: [
                    {
                        id: 'in1',
                        group: 'in',
                        args: { x: 0, y: 10 },
                        attrs: { text: { text: 'in1' } }
                    },
                    {
                        id: 'in2',
                        group: 'in',
                        args: { x: 0, y: 30 },
                        attrs: { text: { text: 'in2' } }
                    },
                    {
                        id: 'out',
                        group: 'out',
                        args: { x: 60, y: 20 },
                        attrs: { text: { text: 'out' } }
                    }
                ]
            },
            markup: [
                {
                    tagName: 'path',
                    selector: 'body'
                },
                {
                    tagName: 'circle',
                    selector: 'output-bubble'
                },
                {
                    tagName: 'text',
                    selector: 'label'
                }
            ]
        });

        return gate;
    }

    private createInputPin(id: string, label?: string): Joint.dia.Element {
        return new Joint.shapes.standard.Circle({
            id: id,
            position: { x: 10, y: 100 },
            size: { width: 30, height: 30 },
            attrs: {
                body: {
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_fill,
                    stroke: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_stroke,
                    strokeWidth: 2
                },
                label: {
                    text: label || 'IN',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').text
                }
            },
            ports: {
                groups: {
                    out: {
                        position: { name: 'right' },
                        attrs: {
                            circle: {
                                r: 4,
                                magnet: true,
                                fill: this.currentStyle.gate_fill,
                                stroke: this.currentStyle.gate_stroke
                            }
                        }
                    }
                },
                items: [
                    { id: 'out', group: 'out' }
                ]
            }
        });
    }

    private createOutputPin(id: string, label?: string): Joint.dia.Element {
        return new Joint.shapes.standard.Circle({
            id: id,
            position: { x: 200, y: 100 },
            size: { width: 30, height: 30 },
            attrs: {
                body: {
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_fill,
                    stroke: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').gate_stroke,
                    strokeWidth: 2
                },
                label: {
                    text: label || 'OUT',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                    fill: this.getCircuitStyleForTheme(localStorage.getItem('theme') || 'dark').text
                }
            },
            ports: {
                groups: {
                    in: {
                        position: { name: 'left' },
                        attrs: {
                            circle: {
                                r: 4,
                                magnet: true,
                                fill: this.currentStyle.gate_fill,
                                stroke: this.currentStyle.gate_stroke
                            }
                        }
                    }
                },
                items: [
                    { id: 'in', group: 'in' }
                ]
            }
        });
    }

    private createGenericGate(id: string, device: { type: string; label?: string }): Joint.dia.Element {
        return new Joint.shapes.standard.Rectangle({
            id: id,
            position: { x: 100, y: 100 },
            size: { width: 60, height: 40 },
            attrs: {
                body: {
                    fill: this.currentStyle.gate_fill,
                    stroke: this.currentStyle.gate_stroke,
                    strokeWidth: 2
                },
                label: {
                    text: device.label || device.type,
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                    fill: this.currentStyle.text
                }
            }
        });
    }

    private createConnection(connector: CircuitData['connectors'][0]): Joint.dia.Link {
        return new Joint.dia.Link({
            source: { id: connector.from.id, selector: connector.from.port },
            target: { id: connector.to.id, selector: connector.to.port },
            attrs: {
                line: {
                    stroke: this.currentStyle.gate_stroke,
                    strokeWidth: 2
                }
            }
        });
    }

    private getCircuitData(): CircuitData {
        // Convert current graph to circuit data format
        const devices: CircuitData['devices'] = {};
        const connectors: CircuitData['connectors'] = [];

        this.graph.getElements().forEach((element: any) => {
            const type = element.get('type');
            // 要素の実際の型に基づいて適切な型を設定
            if (type === 'standard.Path') {
                devices[element.id] = {
                    type: 'Nand',
                    label: 'NAND'
                };
            } else if (type === 'standard.Circle' && element.attributes.attrs.label.text === 'IN') {
                devices[element.id] = {
                    type: 'Input',
                    label: 'IN'
                };
            } else if (type === 'standard.Circle' && element.attributes.attrs.label.text === 'OUT') {
                devices[element.id] = {
                    type: 'Output',
                    label: 'OUT'
                };
            }
        });

        this.graph.getLinks().forEach((link: any) => {
            const source = link.get('source');
            const target = link.get('target');
            if (source && target && source.id && target.id) {
                connectors.push({
                    from: {
                        id: source.id,
                        port: source.port || 'out'  // デフォルトポート名を設定
                    },
                    to: {
                        id: target.id,
                        port: target.port || 'in'   // デフォルトポート名を設定
                    }
                });
                console.log('Added connection:', source.id, '->', target.id);
            }
        });

        return { devices, connectors };
    }

    private resetCircuit(): void {
        if (window.confirm('Are you sure you want to reset the circuit?')) {
            this.graph.clear();
            vscode.postMessage({ command: 'resetCircuit' });
        }
    }

    private getCircuitStyleForTheme(theme: string): CircuitStyle {
        const lightStyle: CircuitStyle = {
            background: '#ffffff',
            stroke: '#000000',
            fill: '#ffffff',
            text: '#333333',
            gate_fill: '#ffffff',
            gate_stroke: '#000000'
        };

        const darkStyle: CircuitStyle = {
            background: '#252526',
            stroke: '#ffffff',
            fill: '#252526',
            text: '#ffffff',
            gate_fill: '#252526',
            gate_stroke: '#ffffff'
        };

        return theme === 'light' ? lightStyle : darkStyle;
    }

    private setTheme(theme: string, button: HTMLElement): void {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        button.textContent = theme === 'dark' ? 'Dark' : 'Light';
        localStorage.setItem('theme', theme);
        this.updateCircuitStyle(this.getCircuitStyleForTheme(theme));
    }

    private showValidationResult(result: ValidationResult): void {
        const validationDiv = document.getElementById('validation-result');
        const messageDiv = document.getElementById('validation-message');
        const gateCount = document.getElementById('gate-count');
        const stepCount = document.getElementById('step-count');
        const stars = document.getElementById('stars');

        if (validationDiv && messageDiv && gateCount && stepCount && stars) {
            validationDiv.style.display = 'block';
            // テーブル形式で入出力を表示
            const testCasesHtml = this._currentLevel?.requirements.testCases.map((testCase, index) => `
                <tr>
                    <td>${testCase.input.join(', ')}</td>
                    <td>${testCase.output.join(', ')}</td>
                    <td>${result.success ? '✔' :
                        (result.details?.failedTests?.some(test =>
                            test.input.join(',') === testCase.input.join(',')) ? '✘' : '✔')}</td>
                </tr>
            `).join('') || '';

            const resultHtml = `
                <div class="test-results">
                    <table>
                        <thead>
                            <tr>
                                <th>Input</th>
                                <th>Output</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${testCasesHtml}
                        </tbody>
                    </table>
                </div>
                <div class="circuit-stats">
                    <p>${result.details?.gateCount || 0} components used. ${result.details?.gateCount || 0} nand gates in total.</p>
                    ${result.success ? `<p class="stars">${'⭐'.repeat(result.details?.stars || 0)}</p>` : ''}
                </div>
            `;

            messageDiv.innerHTML = resultHtml;
            messageDiv.style.color = result.success ? 'green' : 'red';
        }
    }
}

// Initialize the circuit editor when the DOM is loaded
window.addEventListener('load', () => {
    new CircuitEditor();
});