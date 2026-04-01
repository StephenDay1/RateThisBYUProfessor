// Listener must NOT be async to properly use return true for sendResponse
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findProfessor") {
        // We call the async function here instead of making the listener async
        fetchRating(request.name)
            .then(rating => {
                // console.log(`Sending back rating: ${rating}`);
                sendResponse({ rating: rating });
            })
            .catch(err => {
                console.error("Fetch process failed:", err);
                sendResponse({ rating: "Error", message: err.message });
            });
        
        return true; // CRITICAL: Tells Chrome to keep the message channel open
    }
});

async function fetchRating(name) {
    const queryName = encodeURIComponent(name);
    const url = `https://www.ratemyprofessors.com/search/professors/?q=${queryName}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // 2026 "Human-Like" Headers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }

        const html = await response.text();

        professorData = {
            rating: "N/A",
            url: "N/A",
            difficulty: "N/A",
            wouldTakeAgain: "N/A",
            numRatings: "N/A",
            tags: []
        }

        resultDivs = [...html.matchAll(/TeacherCard__StyledTeacherCard-syjs0d-0[^>]*>([\s\S]*?)<\/div>/g)];

        // console.log("Result Divs Count:", resultDivs);

        for (let index = 0; index < resultDivs.length; index++) {
            const divContent = resultDivs[index][1];
            if (divContent.toLowerCase().includes("brigham young university")) {
                // Extract info page URL
                // <a class="TeacherCard__StyledTeacherCard-syjs0d-0 eerjaA" href="/professor/2918231"><div class="TeacherCard__InfoRatingWrapper-syjs0d-3 kAxNBg"><div class="TeacherCard__NumRatingWrapper-syjs0d-2 bvYZTI"><div class="CardNumRating__StyledCardNumRating-sc-17t4b9u-0 cSNjdE"><div class="CardNumRating__CardNumRatingHeader-sc-17t4b9u-1 lhHpkk">QUALITY</div><div class="CardNumRating__CardNumRatingNumber-sc-17t4b9u-2 ERCLc">4.7</div><div class="CardNumRating__CardNumRatingCount-sc-17t4b9u-3 ckSFVh">104 ratings</div></div></div><div class="TeacherCard__CardInfo-syjs0d-1 cwMOi"><div class="CardName__StyledCardName-sc-1gyrgim-0 gGdQEj">Ariel Cuadra</div><div class="CardSchool__StyledCardSchool-sc-19lmz2k-2 irrVnX"><div class="CardSchool__Department-sc-19lmz2k-0 hRJPlj">Ancient Scripture</div><div class="CardSchool__School-sc-19lmz2k-1 bjvHvb">Brigham Young University</div></div><div class="CardFeedback__StyledCardFeedback-lq6nix-0 cLXvfC"><div class="CardFeedback__CardFeedbackItem-lq6nix-1 bqWpYz"><div class="CardFeedback__CardFeedbackNumber-lq6nix-2 iHkSBk">89%</div> would take again</div><div class="VerticalSeparator-sc-1l9ngcr-0 kXhgKB"></div> <div class="CardFeedback__CardFeedbackItem-lq6nix-1 bqWpYz"><div class="CardFeedback__CardFeedbackNumber-lq6nix-2 iHkSBk">2.3</div> level of difficulty</div></div></div></div><button data-tooltip="true" data-tip="Save Professor" data-for="GLOBAL_TOOLTIP" alt="Bookmark" class="TeacherBookmark__StyledTeacherBookmark-sc-17dr6wh-0 dihavS" type="button" currentitem="false"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="Icons/Bookmark-Outline"><path id="Mask" fill-rule="evenodd" clip-rule="evenodd" d="M7 3H17C18.1 3 19 3.9 19 5V21L12 17L5 21L5.01 5C5.01 3.9 5.9 3 7 3ZM12 14.82L17 18V5H7V18L12 14.82Z" fill="#7e7e7e"></path></g></svg></button></a>
                const infoPageURLMatch = [...html.matchAll(/TeacherCard__StyledTeacherCard-syjs0d-0 eerjaA" href="\/professor\/(\d+)"/g)];
                console.log(infoPageURLMatch);
                // const infoPageURLMatch = [...html.matchAll(/TeacherCard__StyledTeacherCard-syjs0d-0[^>]*href="([^"]+)"/g)][index];
                // console.log("Info Page URL Match:", infoPageURLMatch);
                if (infoPageURLMatch[index] && infoPageURLMatch[index][1]) {
                    professorData.url = `https://www.ratemyprofessors.com/professor/${infoPageURLMatch[index][1]}`;
                }

                break;
            }
        }


        
        // const schoolMatch = [...html.matchAll(/CardSchool__School-sc-19lmz2k-1[^>]*>([^<]+)</g)];
        // let index = 0;
        // for (index = 0; index < schoolMatch.length; index++) {
        //     const match = schoolMatch[index];
        //     if (match[1].toLowerCase().includes("brigham young university")) {
        //         professorData.school = match[1].trim();
        //         break;
        //     }
        // }
        // console.log("School Match:", schoolMatch);
        // // if (schoolMatch && schoolMatch[index] && schoolMatch[index][1]) {
        // //     professorData.school = schoolMatch[index][1].trim();
        // // }
        
        // const ratingMatch = [...html.matchAll(/CardNumRating__CardNumRatingNumber-sc-17t4b9u-2[^>]*>([\d.]+)</g)][index];
        
        // if (ratingMatch && ratingMatch[1]) {
        //     professorData.rating = ratingMatch[1];
        // }

        // infoPageURLMatch = [...html.matchAll(/TeacherCard__StyledTeacherCard-syjs0d-0[^>]*href="([^"]+)"/g)][index];
        // return infoPageURLMatch[1];
        if (professorData.url !== "N/A") {
            const infoPageURL = `${professorData.url}`;
            const infoResponse = await fetch(infoPageURL, {
                method: 'GET',
                headers: {
                    // 2026 "Human-Like" Headers
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            });

            if (infoResponse.ok) {
                const infoHTML = await infoResponse.text();

                // <div class="RatingValue__Numerator-qw8sqy-2 duhvlP">4.7</div>
                const ratingMatch = infoHTML.match(/RatingValue__Numerator-qw8sqy-2[^>]*>([\d.]+)</);
                if (ratingMatch && ratingMatch[1]) {
                    professorData.rating = ratingMatch[1];
                }

                const descriptionMatch = infoHTML.match(/TeacherInfo__TeacherInfoContainer-sc-1h7j6kz-0[^>]*>([\s\S]*?)<\/div>/);
                if (descriptionMatch && descriptionMatch[1]) {
                    professorData.description = descriptionMatch[1].trim();
                }

                const feedbackMatches = [...infoHTML.matchAll(/FeedbackItem__FeedbackNumber-uof32n-1[^>]*>([\d.]+%?)</g)];

                const wouldTakeAgainMatch = feedbackMatches.find(m => m[1].includes('%'));
                if (wouldTakeAgainMatch) {
                    professorData.wouldTakeAgain = wouldTakeAgainMatch[1];
                }

                const difficultyMatch = feedbackMatches.find(m => !m[1].includes('%'));
                if (difficultyMatch) {
                    professorData.difficulty = difficultyMatch[1];
                }

                // TeacherRatingTabs__StyledTab-pnmswv-2
                const numRatingsMatch = infoHTML.match(/TeacherRatingTabs__StyledTab-pnmswv-2[^>]*>(\d+)</);
                // console.log("Num Ratings Match:", numRatingsMatch);
                if (numRatingsMatch && numRatingsMatch[1]) {
                    professorData.numRatings = numRatingsMatch[1];
                }

                // <span class="Tag-bs9vf4-0 bmtbjB">Amazing lectures </span>
                // <div class="TeacherTags__TagsContainer-sc-16vmh1y-0 kJSpQS"><span class="Tag-bs9vf4-0 bmtbjB">Amazing lectures </span><span class="Tag-bs9vf4-0 bmtbjB">Caring</span><span class="Tag-bs9vf4-0 bmtbjB">Hilarious</span><span class="Tag-bs9vf4-0 bmtbjB">Inspirational</span><span class="Tag-bs9vf4-0 bmtbjB">Participation matters</span></div>
                const tagsMatches = [...infoHTML.matchAll(/<span class="Tag-bs9vf4-0[^>]*>([^<]+)</g)];
                professorData.tags = tagsMatches.map(match => match[1].split('<')[0].trim());

                occurences = {};
                professorData.tags.forEach(tag => {
                    occurences[tag] = (occurences[tag] || 0) + 1;
                });

                professorData.tags = Object.keys(occurences).filter(tag => occurences[tag] > 1);

            }
        }

        return professorData;


    } catch (error) {
        console.error("Scrape internal error:", error);
        throw error; // Rethrow to be caught by the .catch in the listener
    }
}