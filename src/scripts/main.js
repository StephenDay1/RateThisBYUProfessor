console.log("Rate This BYU Professor is active!");

const observer = new MutationObserver(function(mutations) {
    detectUrlChange();
    tryFindingProfessors();

    applyAlertCleanup();
    applyUnavailableClassFilter();
    applyPromotionBanner();
});

// Function declarations so get_rating.js can pause observation while it edits the page.
function pauseObserver() {
    observer.disconnect();
}

function resumeObserver() {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

observer.observe(document.body, {
    childList: true,
    subtree: true
});

async function tryFindingProfessors(options = {}) {
    const { forceRefresh = false } = options;
    const fragment = window.location.hash.substring(1);
    if (fragment === "/") {
        // Dashboard / Home page
        // Check if registering for future term or viewing past term.
        const classListingElements = document.querySelectorAll(".cdSectionRoot");
        if (!classListingElements || classListingElements.length === 0) {
            return;
        }
        if (!forceRefresh && Array.from(classListingElements).some(el => el.attributes['rated-already'] && el.attributes['rated-already'].value === "true")) {
            return;
        }
        // console.log("Class listing elements found:", classListingElements);
        for (const el of classListingElements) {
            el.setAttribute("rated-already", "true");
        }
        const isRegistrationForFuture = classListingElements[0].closest('.cdRegCartDraggable') !== null;
        if (isRegistrationForFuture) {
            await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3 of .verticallyCentered)"), { force: forceRefresh });
        } else {
            await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3)"), { force: forceRefresh });
        }
    } else if (fragment.includes("chooseASection")) {
        // Registration / Class search
        await get_rating(document.querySelectorAll(".sectionDetailsCol > h4"), { force: forceRefresh });
    }
}

let lastKnownUrl = window.location.href;

function clearRatedAlreadyFlags() {
    const ratedSections = document.querySelectorAll(".cdSectionRoot[rated-already='true']");
    ratedSections.forEach((section) => section.removeAttribute("rated-already"));
}

function detectUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl === lastKnownUrl) {
        return;
    }

    lastKnownUrl = currentUrl;
    // console.log("URL changed, rerunning professor rating injection.");
    clearRatedAlreadyFlags();

    // Run immediately and then again shortly after to catch async SPA renders.
    tryFindingProfessors({ forceRefresh: true });
    setTimeout(() => tryFindingProfessors({ forceRefresh: true }), 500);
    setTimeout(() => tryFindingProfessors({ forceRefresh: true }), 1500);
}

window.addEventListener("hashchange", detectUrlChange);
window.addEventListener("popstate", detectUrlChange);

const originalPushState = history.pushState;
history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    detectUrlChange();
    return result;
};

const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    detectUrlChange();
    return result;
};
