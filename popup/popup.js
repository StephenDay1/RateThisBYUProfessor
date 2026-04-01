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
  const cacheCountEl = document.getElementById("cacheCount");
  const tbody = document.getElementById("cachedProfessorsBody");
  const hint = document.getElementById("cachedSummaryHint");

  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  if (cacheCountEl) cacheCountEl.textContent = String(keys.length);
  if (hint) hint.textContent = keys.length ? `(${keys.length})` : "";

  if (!tbody) return;

  tbody.replaceChildren();

  if (keys.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "muted";
    td.textContent = "No cached professors yet. Visit MyMAP to load ratings.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const name of keys) {
    const raw = all[name];
    let scoreText = "—";
    let dateText = "—";

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      scoreText = formatScore(raw.score);
      dateText = formatCachedDate(raw.date);
    } else if (raw !== undefined) {
      scoreText = "—";
      dateText = "—";
    }

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = name;

    const tdScore = document.createElement("td");
    tdScore.className = "num";
    tdScore.textContent = scoreText;

    const tdDate = document.createElement("td");
    tdDate.textContent = dateText;

    tr.append(tdName, tdScore, tdDate);
    tbody.appendChild(tr);
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
    const tbody = document.getElementById("cachedProfessorsBody");
    if (tbody) {
      tbody.replaceChildren();
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "muted";
      td.textContent = `Could not read cache: ${e?.message ?? String(e)}`;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    setStatus(`Could not read cache: ${e?.message ?? String(e)}`);
  }

  const button = document.getElementById("clearCacheButton");
  if (button) button.addEventListener("click", clearCache);
});
