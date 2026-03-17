const vscode = require("vscode");

class ViewsTreeProvider {
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

  getChildren(element) {
    if (element) {
      // Children of a view = its repos
      const repos = this._store.getView(element.viewName);
      if (!repos) return [];
      return repos.map((repo) => {
        const item = new vscode.TreeItem(
          repo,
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("repo");
        item.contextValue = "repo";
        return item;
      });
    }

    // Root = all views
    const views = this._store.getAllViews();
    const active = this._store.getActive();
    const names = Object.keys(views);

    if (names.length === 0) {
      const empty = new vscode.TreeItem(
        "No views yet — click + to create one",
        vscode.TreeItemCollapsibleState.None,
      );
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }

    return names.map((name) => {
      const repos = views[name];
      const isActive = active === name;
      const icon = isActive ? "pin" : "layers";
      const desc = `${repos.length} repos${isActive ? "  ★ active" : ""}`;

      const item = new vscode.TreeItem(
        name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon(icon);
      item.description = desc;
      item.contextValue = "view";
      item.viewName = name;

      if (!isActive) {
        item.command = {
          command: "workspaceViews.useView",
          title: "Activate View",
          arguments: [item],
        };
      }

      return item;
    });
  }
}

module.exports = { ViewsTreeProvider };
