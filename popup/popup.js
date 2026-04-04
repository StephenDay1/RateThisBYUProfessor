function setStatus(message) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message ?? "";
}

function formatCachedDate(value) {
  if (value == null) return "—";
  const ms = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function formatScore(value) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

async function refreshCacheUI() {
  const button = document.getElementById("clearCacheButton");

  const all = await chrome.storage.local.get(null);
  const count = Object.keys(all).length;

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
    const count = Object.keys(before).length;

    await chrome.storage.local.clear();

    await refreshCacheUI();
    setStatus(
      count === 0
        ? "Cache already empty."
        : `Cleared ${count} cached rating${count === 1 ? "" : "s"}.`
    );
  } catch (e) {
    setStatus(`Failed to clear cache: ${e?.message ?? String(e)}`);
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await refreshCacheUI();
  } catch (e) {
    const button = document.getElementById("clearCacheButton");
    if (button) button.style.display = "none";
    setStatus(`Could not read cache: ${e?.message ?? String(e)}`);
  }

  const button = document.getElementById("clearCacheButton");
  if (button) button.addEventListener("click", clearCache);
});
