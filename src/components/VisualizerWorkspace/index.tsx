import React from 'react';
import classNames from 'classnames';

import * as core from '@core';

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
    } catch (e: any) {
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
      <>
        <section className="section">
          <div className="container is-fluid">
            <div className="field">
              <label className="label">Enter base64 encoded BOC:</label>
              <div className="control">
                <textarea
                  className={classNames('textarea', { 'is-danger': error != null })}
                  spellCheck={false}
                  onChange={this.onInput}
                  value={input}
                  rows={5}
                />
              </div>
              {error != null && <p className="help is-danger">{error}</p>}
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container is-fluid">
            <h5 className="title is-size-5">Output:</h5>
            <pre>{error == null ? decoded : null}</pre>
          </div>
        </section>
      </>
    );
  }
}
