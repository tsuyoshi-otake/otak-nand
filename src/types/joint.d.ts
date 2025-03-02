declare module '@joint/core' {
    export class Circuit {
        static Graph: typeof Graph;
        static Paper: typeof Paper;
        static Device: typeof Device;
        static Wire: typeof Wire;
    }

    export class Graph {
        addCell(cell: Cell): void;
        getElements(): Element[];
        getLinks(): Link[];
        clear(): void;
    }

    export class Paper {
        constructor(options: {
            el: HTMLElement;
            model: Graph;
            width: number;
            height: number;
            gridSize: number;
            drawGrid: boolean;
            background: {
                color: string;
            };
        });
    }

    export class Device {
        constructor(options: {
            id: string;
            type: string;
            label?: string;
        });
        id: string;
        get(attr: string): any;
    }

    export class Wire {
        constructor(options: {
            source: {
                id: string;
                port: string;
            };
            target: {
                id: string;
                port: string;
            };
        });
        get(attr: string): any;
    }

    export type Cell = Device | Wire;
    export type Element = Device;
    export type Link = Wire;
}