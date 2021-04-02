import React from 'react';
import ReactDOM from 'react-dom';

import './index.scss';

import App from './App';
import init, * as core from '../core/pkg';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
