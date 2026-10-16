const SETTINGS_KEYS = new Set(["eliminateAlerts", "hideUnavailableClasses"]);

function setStatus(message) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message ?? "";
}

function isCachedProfessorEntry(key, value) {
  return !SETTINGS_KEYS.has(key) && value && typeof value === "object" && "date" in value;
}

async function loadSettings() {
  const alertsToggle = document.getElementById("eliminateAlertsToggle");
  const classesToggle = document.getElementById("hideUnavailableClassesToggle");

  const { eliminateAlerts = false, hideUnavailableClasses = false } = await chrome.storage.local.get({
    eliminateAlerts: false,
    hideUnavailableClasses: false,
  });
  if (alertsToggle) alertsToggle.checked = Boolean(eliminateAlerts);
  if (classesToggle) classesToggle.checked = Boolean(hideUnavailableClasses);
}

async function saveEliminateAlerts(enabled) {
  await chrome.storage.local.set({ eliminateAlerts: Boolean(enabled) });
}

async function saveHideUnavailableClasses(enabled) {
  await chrome.storage.local.set({ hideUnavailableClasses: Boolean(enabled) });
}

async function refreshCacheUI() {
  const button = document.getElementById("clearCacheButton");

  const all = await chrome.storage.local.get(null);
  const count = Object.entries(all).filter(([key, value]) =>
    isCachedProfessorEntry(key, value)
  ).length;

  if (button) {
    button.textContent = `Clear cached ratings (${count})`;
    button.style.display = count > 0 ? "block" : "none";
  }
}

async function clearCache() {
  const button = document.getElementById("clearCacheButton");
  if (button) button.disabled = true;

  try {
    const before = await chrome.storage.local.get(null);
    const keysToRemove = Object.entries(before)
      .filter(([key, value]) => isCachedProfessorEntry(key, value))
      .map(([key]) => key);

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    await refreshCacheUI();
    setStatus(
      keysToRemove.length === 0
        ? "Cache already empty."
        : `Cleared ${keysToRemove.length} cached rating${keysToRemove.length === 1 ? "" : "s"}.`
    );
  } catch (e) {
    setStatus(`Failed to clear cache: ${e?.message ?? String(e)}`);
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSettings();
    await refreshCacheUI();
  } catch (e) {
    const button = document.getElementById("clearCacheButton");
    if (button) button.style.display = "none";
    setStatus(`Could not read cache: ${e?.message ?? String(e)}`);
  }

  const alertsToggle = document.getElementById("eliminateAlertsToggle");
  if (alertsToggle) {
    alertsToggle.addEventListener("change", async () => {
      try {
        await saveEliminateAlerts(alertsToggle.checked);
        setStatus(alertsToggle.checked ? "MyMap alerts hidden." : "MyMap alerts shown.");
      } catch (e) {
        setStatus(`Failed to save setting: ${e?.message ?? String(e)}`);
      }
    });
  }

  const classesToggle = document.getElementById("hideUnavailableClassesToggle");
  if (classesToggle) {
    classesToggle.addEventListener("change", async () => {
      try {
        await saveHideUnavailableClasses(classesToggle.checked);
        setStatus(classesToggle.checked ? "Unavailable classes hidden." : "Unavailable classes shown.");
      } catch (e) {
        setStatus(`Failed to save setting: ${e?.message ?? String(e)}`);
      }
    });
  }

  const button = document.getElementById("clearCacheButton");
  if (button) button.addEventListener("click", clearCache);
});
