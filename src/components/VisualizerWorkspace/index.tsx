import React from 'react';

import * as core from '../../../core/pkg';

import './style.scss';

export type VisualizerWorkspaceState = {
  input: string;
  decoded: string | null;
  error: string | null;
};

export class VisualizerWorkspace extends React.Component<{}, VisualizerWorkspaceState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      input: '',
      decoded: null,
      error: null
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
      });
    } catch (e) {
      this.setState({
        input: event.target.value,
        decoded: null,
        error: e.toString()
      });
    }
  };

  render() {
    const { input, decoded, error } = this.state;

    return (
      <div className="visualizer-workspace">
        <h1>Enter base64 encoded BOC:</h1>
        <textarea className="w100" spellCheck={false} onChange={this.onInput} value={input} rows={5} />
        <h1>Output:</h1>
        {error == null ? <pre>{decoded}</pre> : <pre className="error">{error}</pre>}
      </div>
    );
  }
}
