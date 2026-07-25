// We only want to run the function once to avoid multiple banners being created.
function runOnce(callback) {
    let hasRun = false;
    return () => {
        if (!hasRun) {
            hasRun = true;
            callback();
        }
    };
}

// Store locally if the banner has been closed and the date it was closed.
function closePromotionBanner() {
    chrome.storage.local.set({ "promotionBannerClosed": true, "promotionBannerClosedDate": new Date().toISOString() });
}

// Check if the banner has been closed and the date it was closed.
async function getBannerClosedStatus() {
    const result = await chrome.storage.local.get({ "promotionBannerClosed": false, "promotionBannerClosedDate": null });
    if (result.promotionBannerClosed) {
        return {closed: true, closedDate: result.promotionBannerClosedDate};
    }
    return {closed: false, closedDate: null};
}

// Create the promotion banner and add it to the page.
function createPromotionBanner() {
    const promotionBanner = document.createElement("article");
    promotionBanner.classList.add("promotion-banner");
    promotionBanner.innerHTML = `
        <p style="margin-right: 10px;">Enjoying <span style="font-weight: bold;">Rate This BYU Professor</span>? Consider leaving a review or sharing it with a friend!</p>
    `;
    promotionBanner.style.position = "fixed";
    promotionBanner.style.zIndex = "2147483647";
    promotionBanner.style.bottom = "0";
    promotionBanner.style.left = "0";
    promotionBanner.style.width = "100%";
    promotionBanner.style.padding = "10px";
    promotionBanner.style.textAlign = "center";
    promotionBanner.style.display = "flex";
    promotionBanner.style.justifyContent = "center";
    promotionBanner.style.alignItems = "center";
    promotionBanner.style.color = "#fff";
    promotionBanner.style.backgroundColor = "#002e5d";

    const linkButton = document.createElement("button");
    // TODO: add arrow icon to button
    linkButton.innerHTML = "Chrome Web Store <span style='font-size: 12px;'>➤</span>";
    linkButton.style.color = "#002e5d";
    linkButton.style.backgroundColor = "#fff";
    linkButton.style.border = "none";
    linkButton.style.borderRadius = "5px";
    linkButton.style.padding = "5px 10px";
    linkButton.style.fontSize = "14px";
    linkButton.style.fontWeight = "bold";
    linkButton.style.textAlign = "center";
    linkButton.style.display = "inline-block";
    linkButton.style.margin = "0 5px";
    linkButton.style.cursor = "pointer";
    linkButton.addEventListener("click", () => {
        window.open("https://chromewebstore.google.com/detail/bdhjildnnfjkjlejbbjonkkegojchgha?utm_source=item-share-cb", "_blank");
        closePromotionBanner();
    });
    promotionBanner.appendChild(linkButton);

    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.style.margin = "10px";
    closeButton.style.position = "absolute";
    closeButton.style.top = "0";
    closeButton.style.right = "0";
    closeButton.style.color = "#fff";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.border = "#fff 1px solid";
    closeButton.style.borderRadius = "5px";
    closeButton.style.padding = "0px 5px";
    closeButton.style.fontSize = "20px";
    // closeButton.style.fontWeight = "bold";
    closeButton.style.cursor = "pointer";
    closeButton.addEventListener("click", () => {
        promotionBanner.style.display = "none";
        closePromotionBanner();
    });
    promotionBanner.appendChild(closeButton);

    const header = document.getElementsByClassName('stickyHeader');
    if (header && header.length > 0) {
        header.item(0).appendChild(promotionBanner);
    }
}

async function tryApplyPromotionBanner() {
    const { closed, closedDate } = await getBannerClosedStatus();
    // Even if the banner has been closed, if it was closed more than 30 days ago, show it again.
    if (closed && new Date(closedDate) > new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)) { // 30 days
        return;
    }
    createPromotionBanner();   
}

// Export the function so it can be used in other files (export keyword isn't allowed in a chrome extension it appears.)
var applyPromotionBanner = runOnce(tryApplyPromotionBanner);
