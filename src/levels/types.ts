export interface CircuitRequirement {
    inputs: number;      // Number of input bits required
    outputs: number;     // Number of output bits required
    testCases: {
        input: number[];  // Input values for testing
        output: number[]; // Expected output values
    }[];
}

export interface LevelDefinition {
    id: string;
    title: string;
    stage: number;
    order: number;
    description: string;
    hint?: string;
    requirements: CircuitRequirement;
    constraints: {
        maxGates?: number;     // Maximum number of gates allowed
        allowedGates: string[]; // Types of gates allowed in this level
    };
    starCriteria: {
        gates: number[];       // Number of gates required for each star [3★, 2★, 1★]
        steps: number[];       // Number of steps required for each star [3★, 2★, 1★]
    };
}

export interface UserProgress {
    levelId: string;
    completed: boolean;
    stars: number;
    solution?: {
        circuit: any;         // DigitalJS circuit definition
        gateCount: number;
        stepCount: number;
    };
}

export type Stage = {
    id: number;
    title: string;
    description: string;
    levels: LevelDefinition[];
};

// Game stages definition
export const Stages: Stage[] = [
    {
        id: 1,
        title: "Logic Gates",
        description: "Learn the basics of digital logic by building fundamental gates using NAND gates.",
        levels: []  // Levels will be loaded from separate files
    },
    {
        id: 2,
        title: "Arithmetics",
        description: "Create circuits that can perform basic arithmetic operations.",
        levels: []
    },
    {
        id: 3,
        title: "Switching",
        description: "Build circuits that can select and route data.",
        levels: []
    },
    {
        id: 4,
        title: "Memory",
        description: "Design circuits that can store and manipulate data.",
        levels: []
    },
    {
        id: 5,
        title: "Processor",
        description: "Combine everything you've learned to build a simple processor.",
        levels: []
    }
];