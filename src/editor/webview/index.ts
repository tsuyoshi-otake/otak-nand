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

interface LevelData {
    title: string;
    description: string;
    template?: CircuitData;
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

class CircuitEditor {
    private paper!: any; // TODO: Fix JointJS typing
    private graph!: Joint.dia.Graph;
    private circuit?: Joint.dia.Graph;

    constructor() {
        this.initializeUI();
        this.setupEventListeners();
    }

    private initializeUI(): void {
        const container = document.getElementById('circuit-container');
        if (!container) {
            return;
        }

        /* Initialize JointJS paper and graph */
        this.graph = new Joint.dia.Graph();
        this.paper = new Joint.dia.Paper({
            el: container,
            model: this.graph,
            width: container.clientWidth,
            height: container.clientHeight,
            gridSize: 10,
            drawGrid: true,
            background: { color: 'white' }
        });
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
                const circuit = this.getCircuitData();
                vscode.postMessage({
                    command: 'validateCircuit',
                    circuit
                });
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetCircuit();
            });
        }

        // パレットの表示/非表示を切り替えるボタン
        const paletteBtn = document.getElementById('paletteBtn');
        const gatePalette = document.getElementById('gate-palette');
        if (paletteBtn && gatePalette) {
            // 初期状態は非表示
            gatePalette.classList.add('hidden');
            
            paletteBtn.addEventListener('click', () => {
                console.log('Show/Hide Gates button clicked');
                if (gatePalette) {
                    console.log('Current palette classes:', gatePalette.className);
                    if (gatePalette.classList.contains('visible')) {
                        console.log('Hiding palette');
                        gatePalette.classList.remove('visible');
                        gatePalette.classList.add('hidden');
                        paletteBtn.textContent = 'Show Gates';
                    } else {
                        console.log('Showing palette');
                        gatePalette.classList.remove('hidden');
                        gatePalette.classList.add('visible');
                        paletteBtn.textContent = 'Hide Gates';
                    }
                    console.log('Updated palette classes:', gatePalette.className);
                }
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
        const levelTitle = document.getElementById('level-title');
        if (levelTitle) {
            levelTitle.textContent = level.title;
        }

        const levelDescription = document.getElementById('level-description');
        if (levelDescription) {
            levelDescription.textContent = level.description;
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
        // Create devices
        Object.entries(circuitData.devices).forEach(([id, device]) => {
            const element = this.createDevice(id, device);
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
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeWidth: 2
                },
                // 否定を表す小円
                circle: {
                    r: 5,
                    cx: 65,
                    cy: 20,
                    fill: '#ffffff',
                    stroke: '#000000',
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
                    fill: '#000000'
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
                                fill: '#ffffff',
                                stroke: '#000000'
                            }
                        }
                    },
                    out: {
                        position: { name: 'right' },
                        attrs: {
                            circle: {
                                r: 4,
                                magnet: true,
                                fill: '#ffffff',
                                stroke: '#000000'
                            }
                        }
                    }
                },
                items: [
                    { id: 'in1', group: 'in', args: { y: 10 } },
                    { id: 'in2', group: 'in', args: { y: 30 } },
                    { id: 'out', group: 'out', args: { y: 20 } }
                ]
            }
        });

        return gate;
    }

    private createInputPin(id: string, label?: string): Joint.dia.Element {
        return new Joint.shapes.standard.Circle({
            id: id,
            position: { x: 50, y: 100 },
            size: { width: 30, height: 30 },
            attrs: {
                body: {
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeWidth: 2
                },
                label: {
                    text: label || 'IN',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle'
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
                                fill: '#ffffff',
                                stroke: '#000000'
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
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeWidth: 2
                },
                label: {
                    text: label || 'OUT',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle'
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
                                fill: '#ffffff',
                                stroke: '#000000'
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
                body: { fill: '#ffffff', stroke: '#000000', strokeWidth: 2 },
                label: {
                    text: device.label || device.type,
                    fontSize: 12,
                    fontFamily: 'Arial',
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle'
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
                    stroke: '#000000',
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

    private showValidationResult(result: ValidationResult): void {
        const validationDiv = document.getElementById('validation-result');
        const messageDiv = document.getElementById('validation-message');
        const gateCount = document.getElementById('gate-count');
        const stepCount = document.getElementById('step-count');
        const stars = document.getElementById('stars');

        if (validationDiv && messageDiv && gateCount && stepCount && stars) {
            validationDiv.style.display = 'block';
            messageDiv.textContent = result.message;
            messageDiv.style.color = result.success ? 'green' : 'red';

            if (result.details) {
                gateCount.textContent = result.details.gateCount.toString();
                stepCount.textContent = result.details.stepCount.toString();
                stars.textContent = '⭐'.repeat(result.details.stars);
            }

            if (!result.success && result.details?.failedTests) {
                const failedTestsHtml = result.details.failedTests.map(test => `
                    <div class="failed-test">
                        <p>入力: ${test.input.join(', ')}</p>
                        <p>期待出力: ${test.expected.join(', ')}</p>
                        <p>実際の出力: ${test.actual.join(', ')}</p>
                    </div>
                `).join('');
                messageDiv.innerHTML += '<div class="failed-tests">' + failedTestsHtml + '</div>';
            }
        }
    }
}

// Initialize the circuit editor when the DOM is loaded
window.addEventListener('load', () => {
    new CircuitEditor();
});