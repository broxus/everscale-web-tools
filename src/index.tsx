import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Switch, Route, Redirect, useHistory, useLocation } from 'react-router-dom';

import 'reset-css';
import './styles/main.scss';

import init from '../core/pkg';
import './common';

import { WorkspaceSelector, WorkspaceItem } from './components/WorkspaceSelector';
import { VisualizerWorkspace } from './components/VisualizerWorkspace';
import { SerializerWorkspace } from './components/SerializerWorkspace';

const WORKSPACES = [
  {
    name: 'Visualizer',
    path: '/visualizer',
    component: () => <VisualizerWorkspace />
  },
  {
    name: 'Serializer',
    path: '/serializer',
    component: () => <SerializerWorkspace />
  }
];

const App: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  return (
    <>
      <WorkspaceSelector>
        {WORKSPACES.map(workspace => (
          <WorkspaceItem
            active={location.pathname === workspace.path}
            name={workspace.name}
            onClick={() => history.push(workspace.path)}
          />
        ))}
      </WorkspaceSelector>
      <hr />
      <Switch>
        <Route exact path="/">
          <Redirect to={WORKSPACES[0].path} />
        </Route>
        {WORKSPACES.map(workspace => (
          <Route exact path={workspace.path}>
            {workspace.component()}
          </Route>
        ))}
      </Switch>
    </>
  );
};

(async () => {
  await init('index_bg.wasm');

  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <App />
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
})();
