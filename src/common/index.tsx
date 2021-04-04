window.ObjectExt = { keys: Object.keys };

export enum Workspace {
  Visualizer,
  Constructor
}

export const WORKSPACES = {
  [Workspace.Visualizer]: 'Visualizer',
  [Workspace.Constructor]: 'Serializer'
};
