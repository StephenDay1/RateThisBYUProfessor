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
            const professorCachedData = await chrome.storage.local.get(professorName);
            
            let professorData = null;
            // If we have data for this professor, use it. We could also check the date to see if it's stale.
            if (Object.keys(professorCachedData).length > 0) {
                const storedEntry = professorCachedData[professorName];
                // If data is older than 3 days, we could flag it, but for now, we use it
                if (storedEntry.date && (Date.now() - storedEntry.date > 1000 * 60 * 60 * 24 * 3)) {
                    console.log(`${professorName}: Cached data is older than 3 days.`);
                }
                // score = storedEntry.score;
                professorData = storedEntry;
                console.log(`Using cached data for ${professorName}:`, professorData);
            } else {
                // 2. Fetch from RateMyProfessors via the Background Script
                console.log(`Searching RMP for: ${professorName}`);
                
                try {
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

                    // 2. Cache the entire flattened object
                    if (professorData && professorData.rating && professorData.rating !== "N/A") {
                        await chrome.storage.local.set({ [professorName]: professorData });
                    }
                } catch (err) {
                    console.error("Error communicating with background script:", err);
                    score = 0;
                }
            }

            // 4. UI Transformation: Create the new display element
            const professorContainer = document.createElement('a');
            if (professorData && professorData.url) {
                professorContainer.href = professorData.url;
                professorContainer.target = "_blank"; // Open in new tab
            }
            professorContainer.classList.add('professor-name', 'newly-added');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = professorName;
            professorContainer.appendChild(nameSpan);

            // Determine color based on score
            const color = professorData.score >= 4 ? "#7ff6c3" : professorData.score >= 3 ? "#fff170" : professorData.score > 0 ? "#ff9c9c" : "#cccccc";
            professorContainer.style.borderLeft = `5px solid ${color}`;
            
            // 5. Create the Popup
            const popup = document.createElement('div');
            popup.classList.add('rating-popup');
            // popup.textContent = professorData.score > 0 ? `Rating: ${professorData.score} / 5` : "No Rating Found";

            const scoreBox = document.createElement('div');
            scoreBox.classList.add('score-box');
            scoreBox.textContent = professorData.score > 0 ? professorData.score.toFixed(1) : "N/A";
            scoreBox.style.backgroundColor = color;
            popup.appendChild(scoreBox);

            const detailsBox = document.createElement('div');
            detailsBox.classList.add('info-panel');
            detailsBox.innerHTML = `
                <div className="info-item"><strong>Difficulty:</strong> ${professorData.difficulty || "N/A"}</div>
                <div className="info-item"><strong>Would Take Again:</strong> ${professorData.wouldTakeAgain || "N/A"}</div>
                <div className="info-item">Based on ${professorData.numRatings} ratings.</div>
            `;
            popup.appendChild(detailsBox);

            professorContainer.appendChild(popup);

            // 6. Interaction Listeners
            let timeout;
            const showPopup = () => {
                popup.style.display = "flex";
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

            // window.addEventListener('mousemove', (e) => {
            //     // Get mouse coordinaates
            //     const x = e.pageX;
            //     const y = e.pageY;

            //     // Apply position
            //     // Subtract from 'y' to move it ABOVE the cursor
            //     // Subtract half the width from 'x' to center it horizontally
            //     // follower.style.left = `${x}px`;
            //     // follower.style.top = `${y - 40}px`;
            //     popup.style.transform = `translate3d(${x}px, ${y - 40}px, 0) translateX(-50%)`;
            // });

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
        // Check if registering for future term or viewing past term.
        const classListingElements = document.querySelectorAll(".cdSectionRoot");
        if (!classListingElements || classListingElements.length === 0 || Array.from(classListingElements).some(el => el.attributes['rated-already'] && el.attributes['rated-already'].value === "true")) {
            return;
        }
        // console.log("Class listing elements found:", classListingElements);
        for (const el of classListingElements) {
            el.setAttribute("rated-already", "true");
        }
        const isRegistrationForFuture = classListingElements[0].closest('.cdRegCartDraggable') !== null;
        if (isRegistrationForFuture) {
            await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3 of .verticallyCentered)"));
        } else {
            await get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3)"));
        }
    } else if (fragment.includes("chooseASection")) {
        // Registration / Class search
        await get_rating(document.querySelectorAll(".sectionDetailsCol > h4"));
    }
}