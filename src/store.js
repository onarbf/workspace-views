const vscode = require("vscode");

/**
 * Persistent store for workspace views.
 * Uses VS Code globalState so views survive across sessions.
 */
class ViewsStore {
  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this._context = context;
  }

  _getData() {
    return this._context.workspaceState.get("workspaceViews", {
      _active: null,
      views: {},
    });
  }

  _setData(data) {
    this._context.workspaceState.update("workspaceViews", data);
  }

  getAllViews() {
    return this._getData().views;
  }

  getView(name) {
    return this._getData().views[name] || null;
  }

  saveView(name, repos) {
    const data = this._getData();
    data.views[name] = repos;
    this._setData(data);
  }

  deleteView(name) {
    const data = this._getData();
    delete data.views[name];
    if (data._active === name) data._active = null;
    this._setData(data);
  }

  getActive() {
    return this._getData()._active;
  }

  setActive(name) {
    const data = this._getData();
    data._active = name;
    this._setData(data);
  }
}

module.exports = { ViewsStore };
