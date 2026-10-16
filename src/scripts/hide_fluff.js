let eliminateAlerts = true;
let hideUnavailableClasses = false;
let hideUnavailableClassesChosen = false;
let fluffSettingsLoaded = false;

let hideUnavailablePrompt = null;
let hideUnavailablePromptNote = null;

async function loadFluffSettings() {
    const stored = await chrome.storage.local.get(["eliminateAlerts", "hideUnavailableClasses"]);
    eliminateAlerts = stored.eliminateAlerts === undefined ? true : Boolean(stored.eliminateAlerts);
    hideUnavailableClassesChosen = Object.prototype.hasOwnProperty.call(stored, "hideUnavailableClasses");
    hideUnavailableClasses = hideUnavailableClassesChosen ? Boolean(stored.hideUnavailableClasses) : false;
}

function isUnavailableNote(element) {
    const text = element.textContent;
    return text.includes("No longer offered") || text.includes("or later");
}

function unavailableClassRow(note) {
    return (note.parentElement && note.parentElement.parentElement) || note;
}

function isShown(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function textRightEdge(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    let right = 0;
    for (const rect of range.getClientRects()) {
        right = Math.max(right, rect.right);
    }
    return right || element.getBoundingClientRect().right;
}

function findVisibleUnavailableNote() {
    for (const element of document.getElementsByClassName("rcNoteText")) {
        if (!isUnavailableNote(element)) {
            continue;
        }
        const row = unavailableClassRow(element);
        if (row && isShown(row)) {
            return element;
        }
    }
    return null;
}

function applyAlertCleanup() {
    if (!eliminateAlerts) {
        return;
    }

    const betaBar = document.querySelector('.betaTestBar');
    if (betaBar && betaBar.style.visibility !== 'hidden') {
        betaBar.style.visibility = 'hidden';
    }
    // Eliminate gap where alert was
    const mainContent = document.querySelector('.mainContentRoot');
    if (mainContent) {
        mainContent.style.marginTop = '100px';
    }
    const notifications = document.querySelectorAll('.resultNotificationRoot');
    notifications.forEach(n => n.remove());
}

function applyUnavailableClassFilter() {
    if (!fluffSettingsLoaded) {
        return;
    }

    if (!hideUnavailableClassesChosen) {
        const note = findVisibleUnavailableNote();
        if (note) {
            showHideUnavailablePrompt(note);
        } else {
            dismissHideUnavailablePrompt();
        }
        return;
    }

    dismissHideUnavailablePrompt();
    if (!hideUnavailableClasses) {
        return;
    }

    for (const element of document.getElementsByClassName("rcNoteText")) {
        if (!isUnavailableNote(element)) {
            continue;
        }
        const row = unavailableClassRow(element);
        if (row) {
            row.style.display = "none";
        }
    }
}

function showUnavailableClasses() {
    for (const element of document.getElementsByClassName("rcNoteText")) {
        if (!isUnavailableNote(element)) {
            continue;
        }
        const row = unavailableClassRow(element);
        if (row) {
            row.style.display = "";
        }
    }
}

function ensureHideUnavailablePrompt() {
    if (hideUnavailablePrompt) {
        return hideUnavailablePrompt;
    }

    const prompt = document.createElement("div");
    prompt.className = "fluff-prompt";
    prompt.setAttribute("role", "dialog");
    prompt.setAttribute("aria-label", "Hide unavailable classes");

    const header = document.createElement("div");
    header.className = "fluff-prompt-header";

    const logo = document.createElement("img");
    logo.className = "fluff-prompt-logo";
    logo.src = chrome.runtime.getURL("images/Logo.png");
    logo.alt = "";

    const title = document.createElement("div");
    title.className = "fluff-prompt-title";
    title.textContent = "Rate This BYU Professor";

    header.append(logo, title);

    const message = document.createElement("div");
    message.className = "fluff-prompt-message";

    const question = document.createElement("p");
    question.textContent = "Would you like to hide all unavailable classes like this one?";

    const hint = document.createElement("p");
    hint.textContent = "You can make them reappear later in extension's settings by clicking on the extension in the top right of your browser.";

    message.append(question, hint);

    const actions = document.createElement("div");
    actions.className = "fluff-prompt-actions";

    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "fluff-prompt-button fluff-prompt-yes";
    yes.textContent = "Yes";
    yes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseHideUnavailableClasses(true);
    });

    const no = document.createElement("button");
    no.type = "button";
    no.className = "fluff-prompt-button fluff-prompt-no";
    no.textContent = "No";
    no.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseHideUnavailableClasses(false);
    });

    const stopDropdownToggle = (event) => {
        event.stopPropagation();
    };
    prompt.addEventListener("mousedown", stopDropdownToggle);
    prompt.addEventListener("click", stopDropdownToggle);

    actions.append(yes, no);
    prompt.append(header, message, actions);
    document.body.appendChild(prompt);
    hideUnavailablePrompt = prompt;
    return prompt;
}

function positionHideUnavailablePrompt(note) {
    const prompt = hideUnavailablePrompt;
    const row = unavailableClassRow(note);
    if (!prompt || !row || !isShown(row)) {
        if (prompt) {
            prompt.style.display = "none";
        }
        return;
    }

    prompt.style.display = "flex";
    const boxRect = row.getBoundingClientRect();
    const width = prompt.offsetWidth || 260;
    const gap = 8;
    const viewportRight = window.innerWidth - gap;
    let left = boxRect.right + gap;
    // A full-width class row has no room outside it, so sit beside the note text.
    if (left + width > viewportRight) {
        left = textRightEdge(note) + gap;
    }
    if (left + width > viewportRight) {
        left = Math.max(gap, viewportRight - width);
    }

    // Measure where top/left 0 lands, then offset from the class row so the
    // prompt lives in the page and scrolls with it.
    prompt.style.top = "0px";
    prompt.style.left = "0px";
    const origin = prompt.getBoundingClientRect();
    prompt.style.top = `${boxRect.top - origin.top}px`;
    prompt.style.left = `${left - origin.left}px`;
}

function showHideUnavailablePrompt(note) {
    const prompt = ensureHideUnavailablePrompt();
    const wasHidden = prompt.style.display !== "flex";
    hideUnavailablePromptNote = note;
    positionHideUnavailablePrompt(note);
    if (wasHidden) {
        prompt.style.opacity = "0";
        requestAnimationFrame(() => {
            if (hideUnavailablePrompt && hideUnavailablePromptNote === note) {
                hideUnavailablePrompt.style.opacity = "1";
            }
        });
    }
}

function dismissHideUnavailablePrompt() {
    hideUnavailablePromptNote = null;
    if (!hideUnavailablePrompt) {
        return;
    }
    hideUnavailablePrompt.remove();
    hideUnavailablePrompt = null;
}

function chooseHideUnavailableClasses(enabled) {
    hideUnavailableClassesChosen = true;
    hideUnavailableClasses = enabled;
    dismissHideUnavailablePrompt();
    if (enabled) {
        applyUnavailableClassFilter();
    }
    chrome.storage.local.set({ hideUnavailableClasses: enabled });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
        return;
    }

    if (changes.eliminateAlerts) {
        eliminateAlerts = Boolean(changes.eliminateAlerts.newValue);
        applyAlertCleanup();
    }

    if (changes.hideUnavailableClasses) {
        hideUnavailableClassesChosen = true;
        hideUnavailableClasses = Boolean(changes.hideUnavailableClasses.newValue);
        dismissHideUnavailablePrompt();
        if (hideUnavailableClasses) {
            applyUnavailableClassFilter();
        } else {
            showUnavailableClasses();
        }
    }
});

loadFluffSettings().then(() => {
    fluffSettingsLoaded = true;
    applyAlertCleanup();
    applyUnavailableClassFilter();
});
