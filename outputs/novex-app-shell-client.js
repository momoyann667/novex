(function () {
  const root = document.querySelector("[data-association-shell]");
  const collapseButton = document.querySelector("[data-sidebar-collapse]");
  const workspaceButton = document.querySelector("[data-workspace-button]");
  const workspaceMenu = document.querySelector("[data-workspace-menu]");
  const commandButtons = document.querySelectorAll("[data-command-open]");
  const commandBackdrop = document.querySelector("[data-command-backdrop]");
  const commandPalette = document.querySelector("[data-command-palette]");
  const notificationButton = document.querySelector("[data-notifications-button]");
  const notificationsMenu = document.querySelector("[data-notifications-menu]");
  const profileButton = document.querySelector("[data-profile-button]");
  const profileMenu = document.querySelector("[data-profile-menu]");
  const quickButton = document.querySelector("[data-quick-open]");
  const quickSheet = document.querySelector("[data-quick-sheet]");
  const financeButton = document.querySelector("[data-finance-open]");
  const financeSheet = document.querySelector("[data-finance-sheet]");
  const moreButton = document.querySelector("[data-more-open]");
  const moreSheet = document.querySelector("[data-more-sheet]");
  const closeSheetButtons = document.querySelectorAll("[data-close-sheet]");
  const loadingRegion = document.querySelector("[data-loading-region]");
  const pageTitle = document.querySelector("[data-page-title]");
  const pageDescription = document.querySelector("[data-page-description]");

  function setExpanded(element, expanded) {
    if (!element) return;
    element.hidden = !expanded;
  }

  function closeFloatingMenus() {
    setExpanded(workspaceMenu, false);
    setExpanded(notificationsMenu, false);
    setExpanded(profileMenu, false);
  }

  function closeSheets() {
    [quickSheet, financeSheet, moreSheet].forEach((sheet) => sheet && sheet.classList.remove("is-open"));
  }

  function openSheet(sheet) {
    closeSheets();
    if (sheet) sheet.classList.add("is-open");
  }

  function openCommandPalette() {
    commandBackdrop && commandBackdrop.classList.add("is-open");
    commandPalette && commandPalette.classList.add("is-open");
    const input = commandPalette && commandPalette.querySelector("input");
    if (input) input.focus();
  }

  function closeCommandPalette() {
    commandBackdrop && commandBackdrop.classList.remove("is-open");
    commandPalette && commandPalette.classList.remove("is-open");
  }

  function simulateWorkspaceSwitch(name) {
    closeFloatingMenus();
    if (!loadingRegion) return;

    loadingRegion.hidden = false;
    loadingRegion.querySelector("[data-loading-title]").textContent = `Chargement de ${name}`;
    if (pageTitle) pageTitle.textContent = "Chargement...";
    if (pageDescription) pageDescription.textContent = "Verification des permissions et isolation des donnees.";

    window.setTimeout(() => {
      loadingRegion.hidden = true;
      if (pageTitle) pageTitle.textContent = "Dashboard";
      if (pageDescription) pageDescription.textContent = `${name} - donnees du workspace actif uniquement.`;
    }, 900);
  }

  if (collapseButton && root) {
    const stored = window.localStorage.getItem("novex:sidebar-collapsed") === "true";
    root.classList.toggle("is-collapsed", stored);

    collapseButton.addEventListener("click", () => {
      const next = !root.classList.contains("is-collapsed");
      root.classList.toggle("is-collapsed", next);
      window.localStorage.setItem("novex:sidebar-collapsed", String(next));
    });
  }

  if (workspaceButton) {
    workspaceButton.addEventListener("click", () => {
      const willOpen = workspaceMenu ? workspaceMenu.hidden : false;
      closeFloatingMenus();
      setExpanded(workspaceMenu, willOpen);
    });
  }

  document.querySelectorAll("[data-switch-workspace]").forEach((button) => {
    button.addEventListener("click", () => simulateWorkspaceSwitch(button.getAttribute("data-switch-workspace") || "Workspace"));
  });

  if (notificationButton) {
    notificationButton.addEventListener("click", () => {
      const willOpen = notificationsMenu ? notificationsMenu.hidden : false;
      closeFloatingMenus();
      setExpanded(notificationsMenu, willOpen);
    });
  }

  if (profileButton) {
    profileButton.addEventListener("click", () => {
      const willOpen = profileMenu ? profileMenu.hidden : false;
      closeFloatingMenus();
      setExpanded(profileMenu, willOpen);
    });
  }

  commandButtons.forEach((button) => button.addEventListener("click", openCommandPalette));
  commandBackdrop && commandBackdrop.addEventListener("click", closeCommandPalette);
  quickButton && quickButton.addEventListener("click", () => openSheet(quickSheet));
  financeButton && financeButton.addEventListener("click", () => openSheet(financeSheet));
  moreButton && moreButton.addEventListener("click", () => openSheet(moreSheet));
  closeSheetButtons.forEach((button) => button.addEventListener("click", closeSheets));

  document.addEventListener("keydown", (event) => {
    const isCommand = event.ctrlKey || event.metaKey;
    if (isCommand && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }

    if (event.key === "Escape") {
      closeCommandPalette();
      closeFloatingMenus();
      closeSheets();
    }
  });
})();
