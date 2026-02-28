// Shared Edit/Sync gate controls used by multiple pages.
(() => {
  function createEditSyncGate(options) {
    const opts = options && typeof options === "object" ? options : {};
    const labels = opts.labels && typeof opts.labels === "object" ? opts.labels : {};

    const root = document.createElement("div");
    root.className = String(opts.rootClass || "edit-gate");

    const buttonClass = String(opts.buttonClass || "");
    const statusClass = String(opts.statusClass || "");

    const editButton = document.createElement("button");
    editButton.type = "button";
    if (buttonClass) editButton.className = buttonClass;
    root.appendChild(editButton);

    const editStatus = document.createElement("span");
    if (statusClass) editStatus.className = statusClass;
    root.appendChild(editStatus);

    const showSync = opts.showSync !== false;
    let syncButton = null;
    let syncStatus = null;
    if (showSync) {
      syncButton = document.createElement("button");
      syncButton.type = "button";
      if (buttonClass) syncButton.className = buttonClass;
      root.appendChild(syncButton);

      syncStatus = document.createElement("span");
      if (statusClass) syncStatus.className = statusClass;
      root.appendChild(syncStatus);
    }

    function isEditUnlocked() {
      return typeof opts.getEditUnlocked === "function" ? !!opts.getEditUnlocked() : false;
    }

    function isSyncConnected() {
      return typeof opts.getSyncConnected === "function" ? !!opts.getSyncConnected() : false;
    }

    function refresh() {
      const unlocked = isEditUnlocked();
      editButton.textContent = unlocked
        ? String(labels.editUnlockedButton || "Lock Edit")
        : String(labels.editLockedButton || "Edit Page");
      editStatus.textContent = unlocked
        ? String(labels.editUnlockedStatus || "Edit unlocked")
        : String(labels.editLockedStatus || "Edit locked");

      if (!showSync || !syncButton || !syncStatus) return;
      const connected = isSyncConnected();
      syncButton.textContent = connected
        ? String(labels.syncConnectedButton || "Host Sync Connected")
        : String(labels.syncDisconnectedButton || "Connect Host Sync");
      syncStatus.textContent = connected
        ? String(labels.syncConnectedStatus || "Host sync ready")
        : String(labels.syncDisconnectedStatus || "Host sync not connected");
    }

    editButton.addEventListener("click", () => {
      if (typeof opts.onEditToggle === "function") {
        const result = opts.onEditToggle(isEditUnlocked());
        if (result === false) return;
      }
      refresh();
    });

    if (showSync && syncButton) {
      syncButton.addEventListener("click", () => {
        if (typeof opts.onSyncClick === "function") {
          const result = opts.onSyncClick(isSyncConnected());
          if (result === false) return;
        }
        refresh();
      });
    }

    refresh();
    return {
      root,
      editButton,
      editStatus,
      syncButton,
      syncStatus,
      refresh,
    };
  }

  window.BGBEditSyncGate = {
    create: createEditSyncGate,
  };
})();
