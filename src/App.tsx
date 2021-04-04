import React from 'react';
import classNames from 'classnames';

import init, * as core from "../core/pkg";

import './App.scss';

declare const ObjectExt: {
    keys<T extends {}>(object: T): (keyof T)[]
}
// @ts-ignore
window.ObjectExt = {keys: Object.keys};

export enum Workspace {
    Visualizer,
    Constructor,
}

const WORKSPACES = {
    [Workspace.Visualizer]: "Visualizer",
    [Workspace.Constructor]: "Constructor",
}

type WorkspaceSelectorProps = {
    workspace: Workspace,
    onChange: (workspace: Workspace) => void,
}

class WorkspaceSelector extends React.Component<WorkspaceSelectorProps, {}> {
    constructor(props: WorkspaceSelectorProps) {
        super(props);
    }

    render() {
        const {workspace: currentWorkspace, onChange} = this.props;

        const select = (workspace: Workspace) => () => onChange(workspace);

        return (
            <div className="App__workspace-selector noselect">
                {ObjectExt.keys(WORKSPACES).map((workspace) => (
                    <div key={workspace} className={classNames({
                        "App__workspace-selector__item": true,
                        "active": workspace == currentWorkspace,
                    })}
                         onClick={select(workspace)}>
                        {WORKSPACES[workspace]}
                    </div>
                ))}
            </div>
        );
    }
}

type ConstructorState = {
    abiInput: string,
    decoded: string | null,
    error: string | null,
};

class Constructor extends React.Component<{}, ConstructorState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            abiInput: '',
            decoded: null,
            error: null,
        };
    }

    onInputAbi = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const abiInput = event.target.value;

        try {
            core.customAbiPrepare(abiInput);

            this.setState({
                abiInput,
                error: null
            });
        } catch (e) {
            this.setState({
                abiInput,
                error: e.toString()
            })
        }
    }

    render() {
        const {abiInput, decoded, error} = this.state;

        return (
            <div className="App__constructor">
                <label>Enter ABI</label>
                <textarea
                    className="w100"
                    onChange={this.onInputAbi}
                    value={abiInput}
                    rows={5}
                />
                <label>Output:</label>
                {error == null
                    ? <pre>{decoded}</pre>
                    : <pre className="error">{error}</pre>}
            </div>
        );
    }
}

type VisualizerState = {
    input: string,
    decoded: string | null,
    error: string | null,
};

class Visualizer extends React.Component<{}, VisualizerState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            input: '',
            decoded: null,
            error: null,
        };
    }

    onInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const input = event.target.value;

        try {
            const decoded = core.decode(input);
            this.setState({
                input,
                decoded,
                error: null
            })
        } catch (e) {
            this.setState({
                input: event.target.value,
                decoded: null,
                error: e.toString()
            })
        }
    }

    render() {
        const {input, decoded, error} = this.state;

        return <div className="App__visualizer">
            <label>Enter base64 encoded BOC:</label>
            <textarea
                className="w100"
                onChange={this.onInput}
                value={input}
                rows={5}
            />
            <label>Output:</label>
            {error == null
                ? <pre>{decoded}</pre>
                : <pre className="error">{error}</pre>}
        </div>;
    }
}

export type AppProps = {};

type AppState = {
    workspace: Workspace,
}

export default class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);

        this.state = {
            workspace: Workspace.Visualizer,
        };
    }

    selectWorkspace = (workspace: Workspace) => {
        this.setState(state => ({
            ...state,
            workspace
        }));
    }

    render() {
        const {workspace} = this.state;

        return (
            <div className="App">
                <WorkspaceSelector workspace={workspace} onChange={this.selectWorkspace}/>
                {workspace == Workspace.Visualizer && <Visualizer/>}
                {workspace == Workspace.Constructor && <Constructor/>}
            </div>
        );
    }
}

(async () => {
    await init('index_bg.wasm');
})();
