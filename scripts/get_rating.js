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

        let professorName = element.textContent.trim();
        if (professorName !== "TBD" && professorName !== "") {
            let score = 0;

            // 1. Check local storage first to save on API calls
            const professorData = await chrome.storage.local.get(professorName);
            
            // TODO clean this later
            let response = null;
            if (Object.keys(professorData).length > 0) {
                const storedEntry = professorData[professorName];
                // If data is older than 3 days, we could flag it, but for now, we use it
                if (storedEntry.date && (Date.now() - storedEntry.date > 1000 * 60 * 60 * 24 * 3)) {
                    console.log(`${professorName}: Cached data is older than 3 days.`);
                }
                score = storedEntry.score;
            } else {
                // 2. Fetch from RateMyProfessors via the Background Script (CORS bypass)
                console.log(`Searching RMP for: ${professorName}`);
                
                try {
                    response = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                            { action: "findProfessor", name: professorName },
                            (res) => resolve(res)
                        );
                    });

                    response = response.rating; // all data is inside .rating
                    console.log(`Received rating for ${professorName}:`, response);

                    // Parse the returned rating or default to 0 if not found
                    score = (response && response.rating && response.rating !== "N/A") 
                            ? parseFloat(response.rating) 
                            : 0;

                    // 3. Cache the result
                    await chrome.storage.local.set({
                        [professorName]: {
                            'score': score,
                            'date': Date.now()
                        }
                    });
                } catch (err) {
                    console.error("Error communicating with background script:", err);
                    score = 0;
                }
            }

            // 4. UI Transformation: Create the new display element
            const professorContainer = document.createElement('div');
            professorContainer.href = response && response.url ? response.url : "#";
            professorContainer.classList.add('professor-name', 'newly-added');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = professorName;
            professorContainer.appendChild(nameSpan);

            // Determine color based on score
            const color = score >= 4 ? "#7ff6c3" : score >= 3 ? "#fff170" : score > 0 ? "#ff9c9c" : "#cccccc";
            professorContainer.style.borderLeft = `5px solid ${color}`;
            
            // 5. Create the Popup
            const popup = document.createElement('div');
            popup.classList.add('rating-popup');
            popup.textContent = score > 0 ? `Rating: ${score} / 5.0` : "No Rating Found";

            professorContainer.appendChild(popup);

            // 6. Interaction Listeners
            let timeout;
            const showPopup = () => {
                popup.style.display = "block";
                timeout = setTimeout(() => { popup.style.opacity = "1"; }, 10);
            };
            const hidePopup = () => {
                clearTimeout(timeout);
                popup.style.opacity = "0";
                setTimeout(() => { popup.style.display = "none"; }, 400);
            };

            professorContainer.addEventListener('mouseenter', showPopup);
            // professorContainer.addEventListener('click', showPopup);
            professorContainer.addEventListener('mouseleave', hidePopup);

            // 7. Replace original element in the DOM
            element.replaceWith(professorContainer);
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

async function tryFindingProfessors() {
    const fragment = window.location.hash.substring(1);
    if (fragment === "/") {
        // Dashboard / Home page
        await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3)"));
    } else if (fragment.includes("chooseASection")) {
        // Registration / Class search
        await get_rating(document.querySelectorAll(".sectionDetailsCol > h4"));
    }
}