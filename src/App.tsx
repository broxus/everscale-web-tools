import React from 'react';
import './App.scss';
import init, * as core from "../core/pkg";

export type AppProps = {};

export type AppState = {
    input: string,
    decoded: string | null,
    error: string | null,
};

export default class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
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

        return (
            <div className="App">
                <div className="App-inputs">
                    <label>Enter base64 encoded BOC:</label>
                    <textarea
                        onChange={this.onInput}
                        value={input}
                        rows={5}
                    />
                </div>
                <div className="App-output">
                    <label>Output:</label>
                    {error == null ? <pre>{decoded}</pre> : <pre className="App-output__error">{error}</pre>}
                </div>
            </div>
        );
    }
}

(async () => {
    await init('index_bg.wasm');
})();
