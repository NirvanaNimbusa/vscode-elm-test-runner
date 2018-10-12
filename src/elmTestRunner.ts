import * as vscode from 'vscode';
import * as path from 'path';
import { ResultTree, Node } from './resultTree';
import { DiffProvider } from './diffProvider'

import * as child_process from 'child_process'

export class ElmTestsProvider implements vscode.TreeDataProvider<Node> {

	private _onDidChangeTreeData: vscode.EventEmitter<Node | null> = new vscode.EventEmitter<Node | null>();
	readonly onDidChangeTreeData: vscode.Event<Node | null> = this._onDidChangeTreeData.event;

	private enabled: boolean = true
	private _running: boolean = false
	private _skipped: number = 0

	private tree: ResultTree = new ResultTree(this.enabled)

	constructor(private context: vscode.ExtensionContext, private outputChannel: vscode.OutputChannel) {
		this.runElmTestOnce()
	}

	private out(lines: string[]): void {
		lines.forEach(line => this.outputChannel.appendLine(line))
	}

	private replaceOut(lines?: string[]): void {
		this.outputChannel.clear()
		if (lines && lines.length > 0) {
			this.out(lines)
			this.outputChannel.show(true)
		}
	}

	toggle(): void {
		if (this.enabled) {
			this.disable()
		} else {
			this.enable()
		}
	}

	private enable(): void {
		if (this.enabled) {
			return
		}
		this.enabled = true
		this._running = false
		this.runElmTestOnce()
	}

	private disable(): void {
		if (!this.enabled) {
			return
		}
		this.enabled = false
		this.tree = new ResultTree(this.enabled)
		this._onDidChangeTreeData.fire();
	}

	private set running(toggle: boolean) {
		if (this._running == toggle) {
			return
		}

		this._running = toggle
		if (toggle) {
			this._skipped = 0
			if (!this.tree.path) {
				let path = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath
				this.tree = new ResultTree(this.enabled, path)
			}
		} else if (this._skipped > 0) {
			console.info(`Catching up ${this._skipped} triggers.`)
			setTimeout(() => this.runElmTestOnce(), 500)
		}
		this._onDidChangeTreeData.fire();
	}

	private get running(): boolean {
		return this._running
	}

	private get needToSkip(): boolean {
		if (this._running) {
			this._skipped++
			return true
		}
		return false
	}

	private runElmTestAgain() {
		let elm = child_process.spawn('elm', ['test', '--report', 'json'], {
			cwd: this.tree.path,
			env: process.env
		})

		elm.stdout.on('data', (data: string) => {
			let lines = data.toString().split('\n')
			lines
				.forEach(line => {
					// console.log(`lines ${lines.length}`)
					this.tree.parse([line])
					this._onDidChangeTreeData.fire()
				})
		})

		elm.stderr.on('data', (data: string) => {
			let lines = data.toString().split('\n')
			console.log(lines)
		})

		elm.on('close', (code) => {
			this.running = false
		});
	}

	getOrCreateTerminal(name: string): vscode.Terminal {
		const terminals = vscode.window.terminals;
		const found = terminals.find(t => t.name == name)

		if (found) {
			return found
		}

		let terminal = vscode.window.createTerminal({
			name: name,
			cwd: this.tree.path
			// env: process.env 
		});

		(<any>terminal).onDidWriteData((data: string) => {
			if (data.indexOf('TEST RUN PASSED') > -1 || data.indexOf('TEST RUN FAILED') > -1) {
				this.runElmTestAgain();
			}
			if (data.indexOf('Compilation failed') > -1) {
				this.running = false
			}
		})

		return terminal
	}

	runElmTestOnce() {
		if (!this.enabled) {
			return
		}

		if (this.needToSkip) {
			return
		}

		this.running = true

		let terminal = this.getOrCreateTerminal('Elm Test Run')

		terminal.sendText("elm test")
		terminal.show()
	}

	getChildren(node?: Node): Thenable<Node[]> {
		if (!node) {
			return Promise.resolve(this.tree.root.subs)
		}
		return Promise.resolve(node.subs)
	}

	getTreeItem(node: Node): vscode.TreeItem {
		let result = new vscode.TreeItem(this.getLabel(node), this.getState(node))
		result.iconPath = this.getIcon(node)
		result.id = node.id

		if (node.testModuleAndName) {
			let [module, testName] = node.testModuleAndName
			result.command = {
				command: 'extension.openElmTestSelection',
				title: '',
				arguments: [node.messages, module, testName]
			}
			if (node.canDiff) {
				result.contextValue = 'canDiff'
			}
		} else if (node.testModule) {
			result.command = {
				command: 'extension.openElmTestSelection',
				title: '',
				arguments: [node.messages, node.testModule]
			}
		}
		return result
	}

	private getState(node: Node): vscode.TreeItemCollapsibleState {
		if (node.expanded === undefined) {
			return vscode.TreeItemCollapsibleState.None
		}
		return node.expanded || this.running
			? vscode.TreeItemCollapsibleState.Expanded
			: vscode.TreeItemCollapsibleState.Collapsed
	}

	private testPath(module: string): string {
		let file = module.replace('.', '/')
		return `${this.tree.path}/tests/${file}.elm`
	}

	select(messages: string[], module: string, testName?: string) {
		this.replaceOut(messages)
		vscode.workspace.openTextDocument(this.testPath(module))
			.then(doc => vscode.window.showTextDocument(doc))
			.then(editor => {
				if (testName) {
					let description = '"' + testName + '"'
					let offset = editor.document.getText().indexOf(description)
					if (offset > -1) {
						let pos0 = editor.document.positionAt(offset)
						let pos1 = editor.document.positionAt(offset + description.length)
						editor.selection = new vscode.Selection(pos0, pos1)
						editor.revealRange(new vscode.Range(pos0, pos1))
					}
					return vscode.commands.executeCommand('editor.action.selectHighlights')
				}
			})
	}

	private getIcon(node: Node): any {
		if (this.running) {
			return null
		}
		let icon = node.green
			? this.context.asAbsolutePath(path.join('resources', 'outline-check-24px.svg'))
			: this.context.asAbsolutePath(path.join('resources', 'outline-error_outline-24px.svg'))
		return {
			light: icon,
			dark: icon
		}
	}

	private getLabel(node: Node): string {
		return this.running ? "... " + node.name : node.name
	}

	diff(node: Node) {
		let diff = node.diff
		if (diff) {
			vscode.commands.executeCommand('vscode.diff',
				DiffProvider.encodeContent(diff[0]),
				DiffProvider.encodeContent(diff[1]),
				`EXPECTED | ${node.name} | ACTUAL`
			)
		}
	}
}

