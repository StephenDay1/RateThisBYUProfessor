async function get_rating(elements) {
    for (const element of elements) {
        let professorName = element.textContent;
        if (professorName != "TBD") {
            let score = 0;

            const professorData = await chrome.storage.local.get(professorName);
            if (Object.keys(professorData).length > 0) {
                // If data is more than a few days old, we could re-pull it
                if (professorData[professorName].date != undefined && Date.now() - new Date(professorData[professorName].date) > 1000 * 60 * 60 * 24 * 3) {
                    console.log(professorName + ": This data is old and could be re-pulled");
                }
                score = professorData[professorName].score;
            } else {
                // This would eventually be the actual query
                score = professorName[0].toLowerCase() < 'f' ? 5 : professorName[0].toLowerCase() < 'q' ? 3.5 : 1.5
                chrome.storage.local.set(
                    { [professorName]: {
                        'score': score,
                        'date': Date.now()
                    }}
                );
                console.log(professorName + ": " + score);
            }

            // Make it look pretty!
            color = score >= 4 ? "#7ff6c3" : score >= 3 ? "#fff170" : "#ff9c9c";

            element.style.backgroundColor = "#f7f7f7";
            element.style.borderRadius = "4px";
            element.style.padding = "4px 1px 4px 4px";
            element.style.borderLeft = `5px solid ${color}`;
            element.style.cursor = "pointer";
            
        }
    }
}

console.log("Rate This BYU Professor is active!");

// Easiest way to check if we should look for professors again is by seeing if the page elements updated at all.
const observer = new MutationObserver(function(mutations) {
    tryFindingProfessors();

    // Hide the beta notification bar and the alerts as they appear.
    const betaBar = document.querySelector('.betaTestBar');
    if (betaBar && betaBar.style.visibility !== 'hidden') {
        betaBar.style.visibility = 'hidden';
    }
    const notifications = document.querySelectorAll('.resultNotificationRoot');
    if (notifications.length > 0) {
        notifications.forEach(notification => {
            notification.remove();
        });
    }
});

// We will start by observing the body of the document.
observer.observe(document.body, {
    childList: true,
    subtree: true
});


async function tryFindingProfessors() {
    const fragment = window.location.hash.substring(1);
    if (fragment == "/") {
        // Home page
        console.log("Getting scores for your professors");
        await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3)"));
    } else if (fragment.includes("chooseASection")) {
        // In class selection
        console.log("Getting scores for available professors");
        await get_rating(document.querySelectorAll(".sectionDetailsCol > h4"));
    }
}