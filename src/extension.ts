import * as vscode from 'vscode';
import { CircuitEditorPanel } from './editor/circuitEditor';
import { Level1 } from './levels/stage1/level1';
import { LevelDefinition, Stage, Stages } from './levels/types';

export function activate(context: vscode.ExtensionContext) {
    console.log('NAND Game extension is now active!');

    // Register commands
    let startGameCommand = vscode.commands.registerCommand('otak-nand.startGame', () => {
        CircuitEditorPanel.createOrShow(context.extensionPath);
        vscode.window.showInformationMessage('Welcome to NAND Game!');
    });

    let openLevelCommand = vscode.commands.registerCommand('otak-nand.openLevel', async (levelArg?: LevelDefinition) => {
        if (levelArg) {
            // Level passed directly (from tree view)
            CircuitEditorPanel.createOrShow(context.extensionPath, levelArg);
            return;
        }

        // Show level selection dialog
        const levels = getAllLevels();
        const levelItems = levels.map(level => ({
            label: `Stage ${level.stage}: ${level.title}`,
            description: `Level ${level.order}`,
            level: level
        }));

        const selected = await vscode.window.showQuickPick(levelItems, {
            placeHolder: 'Select a level to play'
        });

        if (selected) {
            CircuitEditorPanel.createOrShow(context.extensionPath, selected.level);
        }
    });

    // Create TreeView for levels
    const levelsTreeProvider = new LevelsTreeProvider();
    const levelsTreeView = vscode.window.createTreeView('otak-nand-levels', {
        treeDataProvider: levelsTreeProvider
    });

    context.subscriptions.push(
        startGameCommand,
        openLevelCommand,
        levelsTreeView
    );
}

class LevelsTreeProvider implements vscode.TreeDataProvider<LevelTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LevelTreeItem | undefined | null | void> = new vscode.EventEmitter<LevelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LevelTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LevelTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: LevelTreeItem): Thenable<LevelTreeItem[]> {
        if (!element) {
            // Root level - return stages
            return Promise.resolve(
                Stages.map(stage => new LevelTreeItem(
                    stage.title,
                    stage.description,
                    vscode.TreeItemCollapsibleState.Expanded,
                    {
                        stage: stage.id
                    }
                ))
            );
        } else {
            const stageId = element.getStage();
            if (stageId !== undefined) {
                // Stage level - return levels in the stage
                const stageLevels = getAllLevels().filter(level =>
                    level.stage === stageId
                );
                
                return Promise.resolve(
                    stageLevels.map(level => new LevelTreeItem(
                        level.title,
                        `Level ${level.order}`,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            level: level
                        },
                        {
                            command: 'otak-nand.openLevel',
                            title: 'Open Level',
                            arguments: [level]
                        }
                    ))
                );
            }
        }
        
        return Promise.resolve([]);
    }
}

class LevelTreeItem extends vscode.TreeItem {
    private _stage?: number;
    private _level?: LevelDefinition;

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        context: {
            stage?: number;
            level?: LevelDefinition;
        },
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this._stage = context.stage;
        this._level = context.level;
        
        // Set contextValue as a string
        this.contextValue = context.stage ? `stage-${context.stage}` :
                           context.level ? `level-${context.level.id}` : undefined;
    }

    public getStage(): number | undefined {
        return this._stage;
    }

    public getLevel(): LevelDefinition | undefined {
        return this._level;
    }
}

function getAllLevels(): LevelDefinition[] {
    // TODO: Load all levels from their respective files
    return [Level1];
}

export function deactivate() {}
