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

interface WebViewMessage {
    command: string;
    level?: LevelData;
    circuit?: CircuitData;
}

// Declare vscode api
declare const vscode: {
    postMessage: (message: any) => void;
};

class CircuitEditor {
    private paper!: Joint.dia.Paper;
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
        return new Joint.shapes.standard.Rectangle({
            id: id,
            position: { x: 100, y: 100 },
            size: { width: 100, height: 60 },
            attrs: {
                body: { fill: '#ffffff', stroke: '#000000' },
                label: { text: device.label || device.type, fill: '#000000' }
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
            devices[element.id] = {
                type: (element as any).get('type'),
                label: (element as any).get('label')
            };
        });

        this.graph.getLinks().forEach((link: any) => {
            const source = (link as any).get('source');
            const target = (link as any).get('target');
            connectors.push({
                from: {
                    id: source.id,
                    port: source.port
                },
                to: {
                    id: target.id,
                    port: target.port
                }
            });
        });

        return { devices, connectors };
    }

    private resetCircuit(): void {
        if (window.confirm('Are you sure you want to reset the circuit?')) {
            this.graph.clear();
            vscode.postMessage({ command: 'resetCircuit' });
        }
    }
}

// Initialize the circuit editor when the DOM is loaded
window.addEventListener('load', () => {
    new CircuitEditor();
});