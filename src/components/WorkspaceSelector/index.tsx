import React from 'react';
import classNames from 'classnames';

import { Workspace, WORKSPACES } from '../../common';

import './style.scss';

type WorkspaceSelectorProps = {
  workspace: Workspace;
  onChange: (workspace: Workspace) => void;
};

export class WorkspaceSelector extends React.Component<WorkspaceSelectorProps, {}> {
  constructor(props: WorkspaceSelectorProps) {
    super(props);
  }

  render() {
    const { workspace: currentWorkspace, onChange } = this.props;

    const select = (workspace: Workspace) => () => onChange(workspace);

    return (
      <div className="workspace-selector noselect">
        {window.ObjectExt.keys(WORKSPACES).map(workspace => (
          <div
            key={workspace}
            className={classNames({
              'workspace-selector__item': true,
              active: workspace == currentWorkspace
            })}
            onClick={select(workspace)}
          >
            {WORKSPACES[workspace]}
          </div>
        ))}
      </div>
    );
  }
}
