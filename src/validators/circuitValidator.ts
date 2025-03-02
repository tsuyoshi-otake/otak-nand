import { LevelDefinition, CircuitRequirement } from '../levels/types';
import { Circuit, CircuitDefinition, Device, Connection } from 'digitaljs';

export interface FailedTest {
    input: number[];
    expected: number[];
    actual: number[];
}

export interface ValidationDetails {
    gateCount: number;
    stepCount: number;
    stars: number;
    failedTests?: FailedTest[];
}

export interface ValidationResult {
    success: boolean;
    message: string;
    details?: ValidationDetails;
}

interface DeviceMap {
    [key: string]: Device;
}

export class CircuitValidator {
    private level: LevelDefinition;
    private circuit: CircuitDefinition;
    private readonly STABILIZATION_TIMEOUT = 100; // milliseconds

    constructor(level: LevelDefinition, circuit: CircuitDefinition) {
        this.level = level;
        this.circuit = circuit;
    }

    public async validate(): Promise<ValidationResult> {
        try {
            // Validate circuit structure
            const structureValidation = this.validateStructure();
            if (!structureValidation.success) {
                return structureValidation;
            }

            // Validate circuit behavior
            const behaviorValidation = await this.validateBehavior();
            if (!behaviorValidation.success) {
                return behaviorValidation;
            }

            // Calculate performance metrics
            const metrics = this.calculateMetrics();

            // Calculate stars
            const stars = this.calculateStars(metrics);

            return {
                success: true,
                message: "Circuit validation successful!",
                details: {
                    ...metrics,
                    stars
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: {
                    gateCount: 0,
                    stepCount: 0,
                    stars: 0
                }
            };
        }
    }

    private validateStructure(): ValidationResult {
        const devices = Object.values(this.circuit.devices) as Device[];
        
        // Check for required inputs and outputs
        const inputs = devices.filter((d: Device): boolean => d.type === "Input");
        const outputs = devices.filter((d: Device): boolean => d.type === "Output");

        if (inputs.length !== this.level.requirements.inputs) {
            return {
                success: false,
                message: `Circuit must have exactly ${this.level.requirements.inputs} input(s).`
            };
        }

        if (outputs.length !== this.level.requirements.outputs) {
            return {
                success: false,
                message: `Circuit must have exactly ${this.level.requirements.outputs} output(s).`
            };
        }

        // Check for allowed gates
        const gates = devices.filter((d: Device): boolean => d.type !== "Input" && d.type !== "Output");
        
        for (const gate of gates) {
            if (!this.level.constraints.allowedGates.includes(gate.type)) {
                return {
                    success: false,
                    message: `Gate type '${gate.type}' is not allowed in this level.`
                };
            }
        }

        // Check gate count limit
        if (this.level.constraints.maxGates && gates.length > this.level.constraints.maxGates) {
            return {
                success: false,
                message: `Too many gates used. Maximum allowed: ${this.level.constraints.maxGates}`
            };
        }

        return {
            success: true,
            message: "Circuit structure is valid."
        };
    }

    private async validateBehavior(): Promise<ValidationResult> {
        const testCircuit = new Circuit(this.circuit);
        const failedTests: FailedTest[] = [];

        try {
            for (const testCase of this.level.requirements.testCases) {
                // Set inputs
                for (let i = 0; i < testCase.input.length; i++) {
                    const inputDevice = `input${i + 1}`;
                    testCircuit.setInput(inputDevice, testCase.input[i]);
                }

                // Wait for circuit to stabilize
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Circuit stabilization timeout'));
                    }, this.STABILIZATION_TIMEOUT);

                    setTimeout(() => {
                        clearTimeout(timeout);
                        resolve();
                    }, this.STABILIZATION_TIMEOUT);
                });

                // Check outputs
                const outputs: number[] = [];
                for (let i = 0; i < testCase.output.length; i++) {
                    const outputDevice = `output${i + 1}`;
                    outputs.push(testCircuit.getOutput(outputDevice));
                }

                // Compare with expected outputs
                if (!this.arraysEqual(outputs, testCase.output)) {
                    failedTests.push({
                        input: testCase.input,
                        expected: testCase.output,
                        actual: outputs
                    });
                }
            }
        } finally {
            testCircuit.shutdown();
        }

        if (failedTests.length > 0) {
            return {
                success: false,
                message: "Circuit behavior does not match requirements.",
                details: {
                    gateCount: 0,
                    stepCount: 0,
                    stars: 0,
                    failedTests
                }
            };
        }

        return {
            success: true,
            message: "Circuit behavior is valid."
        };
    }

    private calculateMetrics(): { gateCount: number; stepCount: number } {
        const devices = Object.values(this.circuit.devices) as Device[];
        const gates = devices.filter((d: Device): boolean => d.type !== "Input" && d.type !== "Output");
        
        // Calculate step count (longest path from input to output)
        const stepCount = this.calculateStepCount();

        return {
            gateCount: gates.length,
            stepCount
        };
    }

    private calculateStepCount(): number {
        const visited = new Set<string>();
        const devices: DeviceMap = this.circuit.devices;
        const connections = this.circuit.connectors;

        const getMaxDepth = (deviceId: string): number => {
            if (visited.has(deviceId)) {
                return 0;
            }
            visited.add(deviceId);

            const device = devices[deviceId];
            if (device.type === "Input") {
                return 0;
            }

            const inputConnections = connections.filter((c: Connection): boolean => c.to.id === deviceId);
            if (inputConnections.length === 0) {
                return 0;
            }

            const depths = inputConnections.map((conn: Connection): number => getMaxDepth(conn.from.id));
            return Math.max(...depths) + 1;
        };

        const outputDevices = Object.entries(devices)
            .filter(([_, device]) => device.type === "Output")
            .map(([id]) => id);

        return Math.max(...outputDevices.map(getMaxDepth));
    }

    private calculateStars(metrics: { gateCount: number; stepCount: number }): number {
        const { gateCount, stepCount } = metrics;
        const { gates, steps } = this.level.starCriteria;

        // Calculate stars based on both gates and steps
        let gateStars = 0;
        let stepStars = 0;

        // Gate count stars
        if (gateCount <= gates[0]) {
            gateStars = 3;
        } else if (gateCount <= gates[1]) {
            gateStars = 2;
        } else if (gateCount <= gates[2]) {
            gateStars = 1;
        }

        // Step count stars
        if (stepCount <= steps[0]) {
            stepStars = 3;
        } else if (stepCount <= steps[1]) {
            stepStars = 2;
        } else if (stepCount <= steps[2]) {
            stepStars = 1;
        }

        // Return the minimum of gate and step stars
        return Math.min(gateStars, stepStars);
    }

    private arraysEqual<T>(a: T[], b: T[]): boolean {
        return Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((val, index) => val === b[index]);
    }
}