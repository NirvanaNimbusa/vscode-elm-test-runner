import { TestSuiteInfo, TestInfo } from "vscode-test-adapter-api";

export function* walk(node: TestSuiteInfo | TestInfo): Generator<TestSuiteInfo | TestInfo> {
    yield node
    if (node.type === 'suite') {
        for (const child of node.children) {
            for (const c of walk(child)) { yield c; }
        }
    }
}

export function getTestInfosByFile(suite: TestSuiteInfo): Readonly<Map<string, TestInfo[]>> {
    const testInfosByFile = new Map<string, TestInfo[]>()
    Array.from(walk(suite))
        .filter(node => node.file)
        .filter(node => node.type === 'test')
        .forEach(node => {
            const file = node.file!
            const testInfo = node as TestInfo
            const infos = testInfosByFile.get(file)
            if (!infos) {
                testInfosByFile.set(file, [testInfo])
            } else {
                testInfosByFile.set(file, [...infos, testInfo])
            }
        })
    return Object.freeze(testInfosByFile);
}

export function findOffsetForTest(names: string[], text: string, getIndent: (index: number) => number): number | undefined {
    const topLevel = names[0]
    const matches = Array.from(text.matchAll(new RegExp(`(describe|test|fuzz\\s+.*?)\\s+"${topLevel}"`, 'g')))
    if (matches.length === 0) {
        return undefined
    }
    const leftMostTopLevelOffset = matches
        .map(match => match.index)
        .map(index => [index, getIndent(index!)])
        .reduce((acc, next) => {
            const accIndent = acc[1];
            const indent = next[1];
            return (indent! < accIndent!) ? next : acc
        })[0]

    if (leftMostTopLevelOffset) {
        const offset = names.reduce(
            (acc: number, name: string) =>
                text.indexOf(`"${name}"`, acc),
            leftMostTopLevelOffset)
        return offset >= 0 ? offset : undefined
    }
    return undefined
}

export function getFilesAndAllTestIds(ids: string[], suite: TestSuiteInfo): [string[], string[]] {
    const selectedIds = new Set(ids)
    const files = Array.from(walk(suite))
        .filter(node => selectedIds.has(node.id))
        .filter(node => node.file)
        .map(node => node.file!)

    const selectedFiles = new Set(files)
    const allIds = Array.from(walk(suite))
        .filter(node => node.file)
        .filter(node => selectedFiles.has(node.file!))
        .map(node => node.id!)

    return [files, allIds]
}

export interface ElmBinaries {
    elmTest?: string,
    elmMake?: string,
    elm?: string
}

export function buildElmTestArgs(binaries: ElmBinaries, files?: string[]): string[] {
    const compiler = binaries.elmMake ?? binaries.elm
    return [
        binaries.elmTest ?? 'elm-test'
    ]
        .concat(
            (compiler && ['--compiler', compiler]) ?? []
        )
        .concat(
            files ?? []
        )
}

export function buildElmTestArgsWithReport(args: string[]): string[] {
    return args.concat([
        '--report', 'json'
    ])
}

export function oneLine(text: string): string {
    const text1 = text.split('\n').join(' ')
    if (text1.length > 20) {
        return text1.substr(0, 20) + ' ...'
    }
    return text1;
}