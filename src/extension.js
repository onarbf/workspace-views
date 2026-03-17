const vscode = require("vscode");
const { ViewsStore } = require("./store");
const { ViewsTreeProvider } = require("./viewsTree");
const { PinnedTreeProvider } = require("./pinnedTree");

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const store = new ViewsStore(context);
  const viewsTree = new ViewsTreeProvider(store);
  const pinnedTree = new PinnedTreeProvider(store);

  vscode.window.registerTreeDataProvider("workspaceViews.views", viewsTree);
  vscode.window.registerTreeDataProvider(
    "workspaceViews.pinnedFolders",
    pinnedTree,
  );

  const refresh = () => {
    viewsTree.refresh();
    pinnedTree.refresh();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("workspaceViews.createView", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "View name",
        placeHolder: "e.g. admin, orchestrator, frontend...",
        validateInput: (v) => {
          if (!v.trim()) return "Name cannot be empty";
          if (store.getView(v.trim()))
            return "A view with this name already exists";
          return null;
        },
      });
      if (!name) return;

      const folders = getAllWorkspaceFolders();
      if (folders.length === 0) {
        vscode.window.showWarningMessage("No workspace folders found.");
        return;
      }

      const picked = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f, picked: false })),
        { canPickMany: true, placeHolder: "Select repos for this view" },
      );
      if (!picked || picked.length === 0) return;

      store.saveView(
        name.trim(),
        picked.map((p) => p.label),
      );
      vscode.window.showInformationMessage(
        `View "${name.trim()}" created with ${picked.length} repos.`,
      );
      refresh();
    }),

    vscode.commands.registerCommand("workspaceViews.useView", async (item) => {
      const name =
        item?.viewName || (await pickViewName(store, "Activate which view?"));
      if (!name) return;

      const repos = store.getView(name);
      if (!repos) return;

      applyView(repos, store);
      store.setActive(name);
      refresh();
      vscode.window.showInformationMessage(
        `View "${name}" active — ${repos.length} repos pinned to top.`,
      );
    }),

    vscode.commands.registerCommand("workspaceViews.editView", async (item) => {
      const name =
        item?.viewName || (await pickViewName(store, "Edit which view?"));
      if (!name) return;

      const current = store.getView(name);
      if (!current) return;

      const currentSet = new Set(current);
      const folders = getAllWorkspaceFolders();

      const picked = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f, picked: currentSet.has(f) })),
        { canPickMany: true, placeHolder: `Edit repos for "${name}"` },
      );
      if (!picked) return;

      store.saveView(
        name,
        picked.map((p) => p.label),
      );

      if (store.getActive() === name) {
        applyView(
          picked.map((p) => p.label),
          store,
        );
      }

      refresh();
      vscode.window.showInformationMessage(`View "${name}" updated.`);
    }),

    vscode.commands.registerCommand(
      "workspaceViews.deleteView",
      async (item) => {
        const name =
          item?.viewName || (await pickViewName(store, "Delete which view?"));
        if (!name) return;

        const confirm = await vscode.window.showWarningMessage(
          `Delete view "${name}"?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;

        const wasActive = store.getActive() === name;
        store.deleteView(name);

        if (wasActive) {
          resetOrder();
          store.setActive(null);
        }

        refresh();
        vscode.window.showInformationMessage(`View "${name}" deleted.`);
      },
    ),

    vscode.commands.registerCommand("workspaceViews.resetOrder", () => {
      resetOrder();
      store.setActive(null);
      refresh();
      vscode.window.showInformationMessage(
        "Repos reset to alphabetical order.",
      );
    }),

    vscode.commands.registerCommand("workspaceViews.refreshViews", () => {
      refresh();
    }),
  );

  // Auto-refresh when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => refresh()),
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAllWorkspaceFolders() {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders
    .map((f) => {
      // Strip ★/· prefix from name if present
      const name = f.name.replace(/^[★·]\s*/, "");
      return name;
    })
    .sort();
}

function applyView(pinnedRepos, store) {
  const wsEdit = new vscode.WorkspaceEdit();
  const allFolders = vscode.workspace.workspaceFolders || [];
  const pinnedSet = new Set(pinnedRepos);

  // Get all folder paths (using clean names)
  const folderMap = new Map();
  for (const f of allFolders) {
    const cleanName = f.name.replace(/^[★·]\s*/, "");
    folderMap.set(cleanName, f.uri);
  }

  // Build new order: pinned first with ★, rest with ·
  const pinned = pinnedRepos.filter((r) => folderMap.has(r));
  const rest = [...folderMap.keys()].filter((r) => !pinnedSet.has(r)).sort();

  const newFolders = [
    ...pinned.map((r) => ({ uri: folderMap.get(r), name: `★ ${r}` })),
    ...rest.map((r) => ({ uri: folderMap.get(r), name: `· ${r}` })),
  ];

  // Remove all, then re-add in new order
  const removeCount = allFolders.length;
  vscode.workspace.updateWorkspaceFolders(0, removeCount, ...newFolders);
}

function resetOrder() {
  const allFolders = vscode.workspace.workspaceFolders || [];
  if (allFolders.length === 0) return;

  const folders = allFolders
    .map((f) => ({
      uri: f.uri,
      cleanName: f.name.replace(/^[★·]\s*/, ""),
    }))
    .sort((a, b) => a.cleanName.localeCompare(b.cleanName));

  // Re-add without prefix names (just uri, no name override)
  vscode.workspace.updateWorkspaceFolders(
    0,
    allFolders.length,
    ...folders.map((f) => ({ uri: f.uri })),
  );
}

async function pickViewName(store, placeholder) {
  const views = store.getAllViews();
  const names = Object.keys(views);
  if (names.length === 0) {
    vscode.window.showWarningMessage("No views defined. Create one first.");
    return null;
  }
  const active = store.getActive();
  const picked = await vscode.window.showQuickPick(
    names.map((n) => ({
      label: `${active === n ? "$(pin) " : ""}${n}`,
      description: `${views[n].length} repos${active === n ? " (active)" : ""}`,
      value: n,
    })),
    { placeHolder: placeholder },
  );
  return picked?.value || null;
}

function deactivate() {}

module.exports = { activate, deactivate };
