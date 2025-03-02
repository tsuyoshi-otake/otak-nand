declare module 'digitaljs' {
    export interface Device {
        type: string;
        label?: string;
        bits?: number;
    }

    export interface Connection {
        from: {
            id: string;
            port: string;
        };
        to: {
            id: string;
            port: string;
        };
    }

    export interface CircuitDefinition {
        devices: { [key: string]: Device };
        connectors: Connection[];
        subcircuits: { [key: string]: CircuitDefinition };
    }

    export class Circuit {
        constructor(definition: CircuitDefinition);
        setInput(deviceName: string, value: number): void;
        getOutput(deviceName: string): number;
        shutdown(): void;
    }
}