// Add the CSS file to the page
function addCSS(fileName) {
  var head = document.head;
  var link = document.createElement("link");

  link.type = "text/css";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL(fileName);

  head.appendChild(link);
}

addCSS("scripts/injected-styles.css");

let sharedRatingPopup = null;
let sharedPopupHideTimeout = null;

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getSharedRatingPopup() {
    if (sharedRatingPopup) {
        return sharedRatingPopup;
    }

    sharedRatingPopup = document.createElement("div");
    sharedRatingPopup.classList.add("rating-popup");
    sharedRatingPopup.style.position = "fixed";
    sharedRatingPopup.style.zIndex = "2147483647";
    sharedRatingPopup.style.pointerEvents = "none";
    sharedRatingPopup.style.display = "none";
    sharedRatingPopup.style.opacity = "0";
    document.body.appendChild(sharedRatingPopup);
    return sharedRatingPopup;
}

function renderPopupContent(payload) {
    const popup = getSharedRatingPopup();
    const color = payload.score >= 4 ? "#7ff6c3" : payload.score >= 3 ? "#fff170" : payload.score > 0 ? "#ff9c9c" : "#cccccc";

    if (payload.score > 0 && payload.rating !== "N/A") {
        const tagsHTML = (payload.tags && payload.tags.length > 0)
            ? `<div class="tags-box">
                ${payload.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
            </div>`
            : "";

        popup.innerHTML = `
            <div class="popup-top-row">
                <div class="score-box" style="background-color: ${color};">
                    ${payload.score.toFixed(1)}
                </div>
                <div class="info-panel">
                    <div class="info-item"><strong>Difficulty:</strong> ${escapeHTML(payload.difficulty || "N/A")}</div>
                    <div class="info-item"><strong>Would Take Again:</strong> ${escapeHTML(payload.wouldTakeAgain || "N/A")}</div>
                    <div class="info-item">Based on ${escapeHTML(payload.numRatings || 0)} ratings.</div>
                </div>
            </div>
            ${tagsHTML}
        `;
    } else {
        popup.innerHTML = `
            <div class="info-panel" style="text-align: center;">
                <h5 style="margin: 0 0 5px 0;">No Rating Found</h5>
                <div style="font-size: 10px;">Click name to search manually.</div>
            </div>
        `;
    }
}

function bindProfessorInteractions(element) {
    if (element.dataset.rtbypBound === "true") {
        return;
    }

    const popup = getSharedRatingPopup();

    const updatePopupPosition = (event) => {
        popup.style.left = `${event.clientX}px`;
        popup.style.top = `${event.clientY - 32}px`;
    };

    const showPopup = (event) => {
        clearTimeout(sharedPopupHideTimeout);
        try {
            const payload = JSON.parse(element.dataset.rtbypPayload || "{}");
            renderPopupContent(payload);
            updatePopupPosition(event);
            popup.style.display = "flex";
            popup.style.opacity = "0";
            setTimeout(() => { popup.style.opacity = "1"; }, 10);
        } catch (err) {
            console.error("Failed to render popup payload:", err);
        }
    };

    const hidePopup = () => {
        clearTimeout(sharedPopupHideTimeout);
        popup.style.opacity = "0";
        sharedPopupHideTimeout = setTimeout(() => { popup.style.display = "none"; }, 400);
    };

    const openProfessorPage = (event) => {
        const url = element.dataset.rtbypUrl;
        if (!url) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
    };

    element.addEventListener("mouseenter", showPopup);
    element.addEventListener("mousemove", updatePopupPosition);
    element.addEventListener("mouseleave", hidePopup);
    element.addEventListener("click", openProfessorPage);
    element.style.cursor = "pointer";
    element.dataset.rtbypBound = "true";
}

async function get_rating(elements, options = {}) {
    const { force = false } = options;
    observer.disconnect(); // Stop observing while we update the page to avoid infinite loops
    
    for (const element of elements) {
        if (!force && element.classList.contains('newly-added')) {
            continue;
        }

        const existingNameSpan = element.querySelector('span');
        let professorName = (force && existingNameSpan ? existingNameSpan.textContent : element.textContent).trim();
        console.log("Professor Name:", professorName);
        if (professorName !== "TBD" && professorName !== "") {
            let score = 0;

            // 1. Check local storage first to save on API calls
            const professorCachedData = await chrome.storage.local.get(professorName);
            
            let professorData = null;
            let needsUpdate = true;

            // If we have data for this professor, check if it's stale.
            if (Object.keys(professorCachedData).length > 0) {
                const storedEntry = professorCachedData[professorName];
                // If data is older than 3 days, we update it
                const daysTilStale = 7;
                if (storedEntry.date && (Date.now() - storedEntry.date > 1000 * 60 * 60 * 24 * daysTilStale)) {
                    // console.log(`${professorName}: Cached data is older than ${daysTilStale} days. Updating...`);
                } else {
                    professorData = storedEntry;
                    needsUpdate = false;
                    // console.log(`Using cached data for ${professorName}:`, professorData);
                }
            }
            
            if (needsUpdate) {
                // 2. Fetch from RateMyProfessors via the Background Script
                console.log(`Searching RMP for: ${professorName}`);
                
                try {
                    // 20ms delay to obey RMP robots.txt crawl-delay
                    await new Promise(resolve => setTimeout(resolve, 20));

                    const rawResponse = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                            { action: "findProfessor", name: professorName },
                            (res) => resolve(res)
                        );
                    });

                    const ratingData = rawResponse.rating; 

                    // 1. Combine everything into one flat object
                    professorData = {
                        date: Date.now(),
                        // Calculate score once here so it's easily accessible later
                        score: (ratingData && ratingData.rating && ratingData.rating !== "N/A") 
                                ? parseFloat(ratingData.rating) 
                                : 0,
                        ...ratingData // This "spreads" all keys (id, department, url, etc.) into professorData
                    };

                    professorData.url = professorData.url || `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(professorName)}&sid=135`; // Fallback to search URL if direct profile URL isn't available

                    console.log(`URL: ${professorData.url} | Rating for ${professorName}:`, professorData);

                    // 2. Cache the entire flattened object
                    if (professorData && professorData.rating && professorData.rating !== "N/A") {
                        await chrome.storage.local.set({ [professorName]: professorData });
                    }
                } catch (err) {
                    console.error("Error communicating with background script:", err);
                    score = 0;
                }
            }

            // Determine color based on score
            const scoreValue = professorData?.score ?? 0;
            const color = scoreValue >= 4 ? "#7ff6c3" : scoreValue >= 3 ? "#fff170" : scoreValue > 0 ? "#ff9c9c" : "#cccccc";
            const profileUrl = professorData?.url || `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(professorName)}&sid=135`;

            // Temporary fix: preserve BYU's original DOM node so semester switching can update text.
            // Only apply visual score indicators to the existing element.
            element.style.borderLeft = `5px solid ${color}`;
            element.style.backgroundColor = '#f7f7f7';
            element.style.paddingLeft = "6px";
            element.style.paddingTop = "2px";
            element.style.paddingBottom = "2px";
            element.style.borderRadius = "4px";
            element.style.color = "#000";

            element.dataset.rtbypUrl = profileUrl;
            element.dataset.rtbypPayload = JSON.stringify({
                score: scoreValue,
                rating: professorData?.rating || "N/A",
                difficulty: professorData?.difficulty || "N/A",
                wouldTakeAgain: professorData?.wouldTakeAgain || "N/A",
                numRatings: professorData?.numRatings || 0,
                tags: Array.isArray(professorData?.tags) ? professorData.tags : []
            });

            bindProfessorInteractions(element);
        } else {
            // Remove the rating indicator if the professor name is not found
            element.style.borderLeft = "none";
            element.style.paddingLeft = "0";
            element.style.borderRadius = "0";
            element.style.paddingTop = "0";
            element.style.paddingBottom = "0";
            element.dataset.rtbypUrl = null;
            element.dataset.rtbypPayload = null;
            element.dataset.rtbypBound = null;
            element.style.cursor = "default";
            element.style.color = "#666";
            element.style.backgroundColor = "transparent";
        }
    }
    
    // Resume observing after updates are done
    observer.observe(document.body, {
        childList: true,
        subtree: true
    }); 
}

console.log("Rate This BYU Professor is active!");

const observer = new MutationObserver(function(mutations) {
    detectUrlChange();
    tryFindingProfessors();

    // UI Cleanup for MyMap
    const betaBar = document.querySelector('.betaTestBar');
    if (betaBar && betaBar.style.visibility !== 'hidden') {
        betaBar.style.visibility = 'hidden';
    }
    const notifications = document.querySelectorAll('.resultNotificationRoot');
    notifications.forEach(n => n.remove());
});

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
    console.log("URL changed, rerunning professor rating injection.");
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
