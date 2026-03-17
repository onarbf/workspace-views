const vscode = require("vscode");

class PinnedTreeProvider {
  constructor(store) {
    this._store = store;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    const active = this._store.getActive();
    if (!active) {
      const item = new vscode.TreeItem(
        "No active view",
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("info");
      item.description = "activate a view to pin repos";
      return [item];
    }

    const repos = this._store.getView(active);
    if (!repos || repos.length === 0) return [];

    const header = new vscode.TreeItem(
      active,
      vscode.TreeItemCollapsibleState.None,
    );
    header.iconPath = new vscode.ThemeIcon("pin");
    header.description = `${repos.length} pinned`;

    const items = repos.map((repo) => {
      const item = new vscode.TreeItem(
        repo,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("star-full");
      item.contextValue = "pinnedRepo";

      // Click to reveal the folder in explorer
      const folder = vscode.workspace.workspaceFolders?.find(
        (f) => f.name.replace(/^[★·]\s*/, "") === repo,
      );
      if (folder) {
        item.resourceUri = folder.uri;
      }

      return item;
    });

    return [header, ...items];
  }
}

module.exports = { PinnedTreeProvider };
