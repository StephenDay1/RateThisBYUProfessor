// Listener must NOT be async to properly use return true for sendResponse
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findProfessor") {
        // We call the async function here instead of making the listener async
        fetchRating(request.name)
            .then(rating => {
                console.log(`Sending back rating: ${rating}`);
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
        
        // Updated Regex for 2026 RMP layout
        // RMP frequently changes class names; this looks for the specific rating number pattern
        const ratingMatch = html.match(/CardNumRating__CardNumRatingNumber-sc-17t4b9u-2[^>]*>([\d.]+)</);
        
        return (ratingMatch && ratingMatch[1]) ? ratingMatch[1] : "N/A";

    } catch (error) {
        console.error("Scrape internal error:", error);
        throw error; // Rethrow to be caught by the .catch in the listener
    }
}