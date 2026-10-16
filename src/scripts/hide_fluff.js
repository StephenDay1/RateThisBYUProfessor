let eliminateAlerts = true;
let hideUnavailableClasses = false;

async function loadFluffSettings() {
    const stored = await chrome.storage.local.get({
        eliminateAlerts: true,
        hideUnavailableClasses: false,
    });
    eliminateAlerts = Boolean(stored.eliminateAlerts);
    hideUnavailableClasses = Boolean(stored.hideUnavailableClasses);
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
    if (!hideUnavailableClasses) {
        return;
    }

    for (const element of document.getElementsByClassName("rcNoteText")) {
        if (element.textContent.includes("No longer offered") || element.textContent.includes("or later")) {
            const row = element.parentElement && element.parentElement.parentElement;
            if (row) {
                row.style.display = "none";
            }
        }
    }
}

function showUnavailableClasses() {
    for (const element of document.getElementsByClassName("rcNoteText")) {
        if (element.textContent.includes("No longer offered") || element.textContent.includes("or later")) {
            const row = element.parentElement && element.parentElement.parentElement;
            if (row) {
                row.style.display = "";
            }
        }
    }
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
        hideUnavailableClasses = Boolean(changes.hideUnavailableClasses.newValue);
        if (hideUnavailableClasses) {
            applyUnavailableClassFilter();
        } else {
            showUnavailableClasses();
        }
    }
});

loadFluffSettings().then(() => {
    applyAlertCleanup();
    applyUnavailableClassFilter();
});
