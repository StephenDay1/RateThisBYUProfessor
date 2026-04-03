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


async function fetchRating(fullName) {
    const endpoint = "https://www.ratemyprofessors.com/graphql";
    const schoolID = "U2Nob29sLTEzNQ=="; // BYU's ID

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0].toLowerCase();
    const lastName = nameParts[nameParts.length - 1].toLowerCase();
const rmpSearch = async (searchText) => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic d2ViOndlYg==',
                'Referer': 'https://www.ratemyprofessors.com/',
            },
            body: JSON.stringify({
                // CHANGED: "search" is now "newSearch"
                "query": `query TeacherSearchPaginationQuery($count: Int!, $query: TeacherSearchQuery!) {
                    newSearch {
                        teachers(query: $query, first: $count) {
                            edges {
                                node {
                                    id
                                    firstName
                                    lastName
                                    avgRating
                                    numRatings
                                    avgDifficulty
                                    wouldTakeAgainPercent
                                    school { name }
                                }
                            }
                        }
                    }
                }`,
                "variables": {
                    "count": 20,
                    "query": {
                        "text": searchText,
                        "schoolID": "U2Nob29sLTEzNQ==", // BYU ID
                        "fallback": true 
                    }
                }
            })
        });

        const result = await response.json();
        
        // CHANGED: Access result.data.newSearch instead of search
        if (!result || !result.data || !result.data.newSearch) {
            console.error("GraphQL Error:", result.errors);
            return [];
        }

        return result.data.newSearch.teachers.edges;
    } catch (err) {
        console.error("Fetch failed:", err);
        return [];
    }
};

    // --- LOGIC FLOW ---
    // 1. Try Full Name (e.g., "Mike P Jones")
    let results = await rmpSearch(fullName);

    // 2. Fallback to Last Name (e.g., "Jones") if no exact match
    if (results.length === 0) {
        results = await rmpSearch(lastName);
    }

    // 3. Find the best match containing the first name
    const bestMatch = results.find(t => {
        const rFirst = t.node.firstName.toLowerCase();
        const rLast = t.node.lastName.toLowerCase();

        // 1. Does the first name match? (Handles "Casey" vs "Casey Paul")
        const firstMatch = rFirst.includes(firstName) || firstName.includes(rFirst);

        // 2. Does the last name match? (Handles "Griffiths" vs "Griffiths-Staten")
        const lastMatch = rLast.includes(lastName) || lastName.includes(rLast);

        return firstMatch && lastMatch;
    });

    if (!bestMatch) return { rating: "N/A" };

    const n = bestMatch.node;
    return {
        rating: n.avgRating || "N/A",
        difficulty: n.avgDifficulty || "N/A",
        wouldTakeAgain: n.wouldTakeAgainPercent > 0 ? `${Math.round(n.wouldTakeAgainPercent)}%` : "N/A",
        numRatings: n.numRatings || 0,
        url: `https://www.ratemyprofessors.com/professor/${n.id}`
    };
}
async function fetchRating(fullName) {
    const endpoint = "https://www.ratemyprofessors.com/graphql";
    const schoolID = "U2Nob29sLTEzNQ=="; // BYU (Change to U2Nob29sLTE0NDI= for UVU)

    // 1. CLEAN THE NAME
    // Removes middle initials: "Mike P Jones" -> "Mike Jones"
    const cleanSearchName = fullName.replace(/\s[A-Z]\s/gi, ' ').trim();
    const nameParts = cleanSearchName.split(/\s+/);
    
    if (nameParts.length < 2) return { rating: "N/A", message: "Invalid Name" };

    const firstName = nameParts[0].toLowerCase();
    const lastName = nameParts[nameParts.length - 1].toLowerCase();

    // INTERNAL HELPER: The GraphQL Request
    const rmpSearch = async (searchText) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic d2ViOndlYg==',
                    'Referer': 'https://www.ratemyprofessors.com/',
                },
                body: JSON.stringify({
                    "query": `query TeacherSearchPaginationQuery($count: Int!, $query: TeacherSearchQuery!) {
                        newSearch {
                            teachers(query: $query, first: $count) {
                                edges {
                                    node {
                                        id
                                        firstName
                                        lastName
                                        avgRating
                                        numRatings
                                        avgDifficulty
                                        wouldTakeAgainPercent
                                        department
                                        school { name }
                                    }
                                }
                            }
                        }
                    }`,
                    "variables": {
                        "count": 50, // Higher count to ensure we find "G Lloyd" among all Lloyds
                        "query": {
                            "text": searchText,
                            "schoolID": schoolID,
                            "fallback": true 
                        }
                    }
                })
            });

            const result = await response.json();
            if (!result || !result.data || !result.data.newSearch) return [];
            return result.data.newSearch.teachers.edges;
        } catch (err) {
            console.error("GraphQL Fetch Error:", err);
            return [];
        }
    };

    try {
        // --- STEP 1: Broad Search ---
        // We search by Last Name immediately to ensure we catch "G Lloyd" 
        // who RMP might only know as "Scott Lloyd"
        let results = await rmpSearch(lastName);

        // --- STEP 2: Advanced Filtering ---
        const bestMatch = results.find(t => {
            const rFirst = t.node.firstName.toLowerCase();
            const rLast = t.node.lastName.toLowerCase();
            
            // Normalize names (remove spaces/hyphens) for "Xianjin" vs "Xian Jin"
            const normRFirst = rFirst.replace(/[\s-]/g, '');
            const normSearchFirst = firstName.replace(/[\s-]/g, '');

            // MATCHING CRITERIA:
            
            // A. Last Name must match
            const lastMatch = rLast.includes(lastName) || lastName.includes(rLast);
            if (!lastMatch) return false;

            // B. First Name Fuzzy Match ("Xianjin" match)
            const fuzzyFirstMatch = normRFirst.includes(normSearchFirst) || 
                                   normSearchFirst.includes(normRFirst);

            // C. Initial Match ("G Lloyd" match)
            // Checks if the MyMap first name is just an initial of the RMP first name
            const isInitialMatch = firstName.length === 1 && rFirst.startsWith(firstName);

            return fuzzyFirstMatch || isInitialMatch;
        });

        // --- STEP 3: Return Formatting ---
        if (!bestMatch) {
            return { rating: "N/A", message: "No matching professor found" };
        }

        const node = bestMatch.node;
        // 1. Decode the "weird code" (Base64)
        // "VGVhY2hlci0yNzExMDk3" becomes "Teacher-2711097"
        const decodedId = atob(node.id); 

        // 2. Extract just the numbers
        const legacyId = decodedId.split('-')[1];
        return {
            rating: node.avgRating !== 0 ? node.avgRating : "N/A",
            difficulty: node.avgDifficulty !== 0 ? node.avgDifficulty : "N/A",
            wouldTakeAgain: node.wouldTakeAgainPercent > 0 ? `${Math.round(node.wouldTakeAgainPercent)}%` : "N/A",
            numRatings: node.numRatings || 0,
            department: node.department || "N/A",
            url: `https://www.ratemyprofessors.com/professor/${legacyId}`,
            matchedName: `${node.firstName} ${node.lastName}` // For your console debugging
        };

    } catch (error) {
        console.error("Scrape Process Error:", error);
        return { rating: "Error", message: error.message };
    }
}