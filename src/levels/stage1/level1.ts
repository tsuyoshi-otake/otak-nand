import { LevelDefinition } from '../types';

export const Level1: LevelDefinition = {
    id: "stage1-level1",
    title: "NOT Gate using NAND",
    stage: 1,
    order: 1,
    description: `
In this first level, you'll learn how to create a NOT gate (inverter) using a NAND gate.

A NOT gate inverts its input:
- When input is 0, output is 1
- When input is 1, output is 0

Hint: A NAND gate with both inputs connected together works as a NOT gate.
This is because:
- When both inputs are 0, output is 1
- When both inputs are 1, output is 0
    `,
    hint: "Connect both inputs of the NAND gate to the same input signal.",
    requirements: {
        inputs: 1,
        outputs: 1,
        testCases: [
            {
                input: [0],
                output: [1]
            },
            {
                input: [1],
                output: [0]
            }
        ]
    },
    constraints: {
        maxGates: 1,
        allowedGates: ["Nand"]
    },
    starCriteria: {
        gates: [1, 1, 2],      // 3★: 1 gate, 2★: 1 gate, 1★: 2 gates
        steps: [2, 3, 4]       // 3★: 2 steps, 2★: 3 steps, 1★: 4 steps
    }
};

// DigitalJS circuit template for this level
export const Level1Template = {
    devices: {
        "input1": {
            type: "Input",
            label: "IN",
            bits: 1
        },
        "output1": {
            type: "Output",
            label: "OUT",
            bits: 1
        }
    },
    connectors: [],
    subcircuits: {}
};

// Solution example (for testing)
export const Level1Solution = {
    devices: {
        "input1": {
            type: "Input",
            label: "IN",
            bits: 1
        },
        "nand1": {
            type: "Nand",
            label: "NAND1",
            bits: 1
        },
        "output1": {
            type: "Output",
            label: "OUT",
            bits: 1
        }
    },
    connectors: [
        {
            from: {
                id: "input1",
                port: "out"
            },
            to: {
                id: "nand1",
                port: "in1"
            }
        },
        {
            from: {
                id: "input1",
                port: "out"
            },
            to: {
                id: "nand1",
                port: "in2"
            }
        },
        {
            from: {
                id: "nand1",
                port: "out"
            },
            to: {
                id: "output1",
                port: "in"
            }
        }
    ],
    subcircuits: {}
};