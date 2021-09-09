import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Switch, Route, Redirect, useHistory, useLocation } from 'react-router-dom';

import './styles/main.scss';

import init from '../core/pkg';
import './common';

import { Navbar } from './components/Navbar';
import { VisualizerWorkspace } from './components/VisualizerWorkspace';
import { SerializerWorkspace } from './components/SerializerWorkspace';

const WORKSPACES = [
  {
    name: 'executor',
    path: '/executor',
    component: () => <VisualizerWorkspace />
  },
  {
    name: 'visualizer',
    path: '/visualizer',
    component: () => <VisualizerWorkspace />
  },
  {
    name: 'serializer',
    path: '/serializer',
    component: () => <SerializerWorkspace />
  }
];

const App: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  return (
    <div className="container is-fluid">
      <Navbar />
      <Switch>
        <Route exact path="/">
          <Redirect to={WORKSPACES[0].path} />
        </Route>
        {WORKSPACES.map(workspace => (
          <Route key={workspace.name} exact path={workspace.path}>
            {workspace.component()}
          </Route>
        ))}
      </Switch>
    </div>
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
