import React from 'react';
import ReactDOM from 'react-dom';

import 'reset-css';
import './styles/main.scss';

import init from '../core/pkg';
import { Workspace } from './common';

import { WorkspaceSelector } from './components/WorkspaceSelector';
import { VisualizerWorkspace } from './components/VisualizerWorkspace';
import { SerializerWorkspace } from './components/SerializerWorkspace';

export type AppProps = {};

type AppState = {
  workspace: Workspace;
};

export default class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    this.state = {
      workspace: Workspace.Visualizer
    };
  }

  selectWorkspace = (workspace: Workspace) => {
    this.setState(state => ({
      ...state,
      workspace
    }));
  };

  render() {
    const { workspace } = this.state;

    return (
      <>
        <WorkspaceSelector workspace={workspace} onChange={this.selectWorkspace} />
        <hr />
        {workspace == Workspace.Visualizer && <VisualizerWorkspace />}
        {workspace == Workspace.Constructor && <SerializerWorkspace />}
      </>
    );
  }
}

(async () => {
  await init('index_bg.wasm');

  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
})();
