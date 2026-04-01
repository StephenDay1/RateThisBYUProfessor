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

async function get_rating(elements) {
    observer.disconnect(); // Stop observing while we update the page to avoid infinite loops
    for (const element of elements) {
        if (element.classList.contains('newly-added')) {
            continue;
        }

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
                await new Promise(resolve => setTimeout(resolve, 2000));
                findProfessor(professorName);

                score = professorName[0].toLowerCase() < 'f' ? 5 : professorName[0].toLowerCase() < 'q' ? 3.5 : 1.5
                chrome.storage.local.set(
                    { [professorName]: {
                        'score': score,
                        'date': Date.now()
                    }}
                );
                console.log(professorName + ": " + score);
            }

            // Copy professor name into the div that will replace it.
            const professorText = document.createElement('div');
            professorText.textContent = element.textContent;

            // Make it look pretty!
            color = score >= 4 ? "#7ff6c3" : score >= 3 ? "#fff170" : "#ff9c9c";

            professorText.classList.add('professor-name', 'newly-added');
            professorText.style.borderLeft = `5px solid ${color}`;
            
            // Popup will appear when hovering over the professor's name, showing the rating.
            const popup = document.createElement('div');
            popup.classList.add('rating-popup');
            popup.textContent = `Rating: ${score}`;
            // popup.style.borderLeft = `5px solid ${color}`;

            professorText.appendChild(popup);

            let timeout;
            professorText.addEventListener('mouseenter', () => {
                popup.style.display = "block";
                timeout = setTimeout(() => {
                    popup.style.opacity = "1";
                }, 100);
            });
            professorText.addEventListener('click', () => {
                popup.style.display = "block";
                timeout = setTimeout(() => {
                    popup.style.opacity = "1";
                }, 100);
            });
            professorText.addEventListener('mouseleave', () => {
                clearTimeout(timeout);
                popup.style.opacity = "0";
                setTimeout(() => {
                    popup.style.display = "none";
                }, 400); // Wait for the transition to finish

            });

            // element.after(popup);
            element.replaceWith(professorText);
            
        }
    }
    observer.observe(document.body, {
        childList: true,
        subtree: true
    }); // Resume observing after updates are done
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