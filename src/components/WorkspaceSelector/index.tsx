import React from 'react';
import classNames from 'classnames';

import './style.scss';

type WorkspaceItem = {
  key?: React.Key | null;
  active: boolean;
  name: string;
  onClick: () => void;
};

export const WorkspaceItem: React.FC<WorkspaceItem> = ({ key, active, name, onClick }) => (
  <div
    key={key}
    className={classNames({
      'workspace-selector__item': true,
      active
    })}
    onClick={onClick}
  >
    {name}
  </div>
);

export const WorkspaceSelector: React.FC = ({ children }) => (
  <div className="workspace-selector noselect">{children}</div>
);
