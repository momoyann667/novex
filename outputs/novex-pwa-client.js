(function () {
  const installCard = document.querySelector("[data-pwa-install]");
  const installButton = document.querySelector("[data-pwa-install-button]");
  const installLaterButton = document.querySelector("[data-pwa-install-later]");
  const offlineBadge = document.querySelector("[data-pwa-offline]");
  const syncBadge = document.querySelector("[data-pwa-sync]");
  const updateCard = document.querySelector("[data-pwa-update]");
  const updateButton = document.querySelector("[data-pwa-update-button]");
  const statusText = document.querySelector("[data-pwa-status]");
  const dismissedAtKey = "novex:pwa-install-dismissed-at";
  const dismissCooldownMs = 7 * 24 * 60 * 60 * 1000;

  let deferredInstallPrompt = null;
  let waitingWorker = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function recentlyDismissed() {
    const dismissedAt = Number(window.localStorage.getItem(dismissedAtKey) || 0);
    return Date.now() - dismissedAt < dismissCooldownMs;
  }

  function setStatus(message) {
    if (statusText) {
      statusText.textContent = message;
    }
  }

  function refreshConnectionState() {
    const online = window.navigator.onLine;

    if (offlineBadge) {
      offlineBadge.hidden = online;
    }

    setStatus(online ? "Connexion retablie." : "Vous etes hors connexion.");

    if (online && syncBadge) {
      syncBadge.hidden = false;
      syncBadge.textContent = "Synchronisation...";
      window.setTimeout(() => {
        syncBadge.textContent = "Synchronisation terminee";
        window.setTimeout(() => {
          syncBadge.hidden = true;
        }, 1800);
      }, 900);
    }
  }

  function maybeShowInstallCard() {
    if (!installCard) {
      return;
    }

    installCard.hidden = isStandalone() || !deferredInstallPrompt || recentlyDismissed();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    maybeShowInstallCard();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installCard) {
      installCard.hidden = true;
    }
    setStatus("NOVEX est installe.");
  });

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        return;
      }

      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      maybeShowInstallCard();
    });
  }

  if (installLaterButton) {
    installLaterButton.addEventListener("click", () => {
      window.localStorage.setItem(dismissedAtKey, String(Date.now()));
      if (installCard) {
        installCard.hidden = true;
      }
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setStatus("Service worker non supporte par ce navigateur.");
      return;
    }

    const registration = await navigator.serviceWorker.register("./novex-pwa-service-worker.js");

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) {
        return;
      }

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = newWorker;
          if (updateCard) {
            updateCard.hidden = false;
          }
        }
      });
    });

    if (registration.waiting) {
      waitingWorker = registration.waiting;
      if (updateCard) {
        updateCard.hidden = false;
      }
    }
  }

  if (updateButton) {
    updateButton.addEventListener("click", () => {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "NOVEX_SKIP_WAITING" });
      }
      window.location.reload();
    });
  }

  window.addEventListener("online", refreshConnectionState);
  window.addEventListener("offline", refreshConnectionState);
  refreshConnectionState();
  maybeShowInstallCard();
  registerServiceWorker().catch(() => setStatus("Impossible d'initialiser le mode PWA."));
})();
