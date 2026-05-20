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


const DEBUG_LOGS = false;

function debugLog(...args) {
    if (DEBUG_LOGS) {
        console.log(...args);
    }
}

function normalizeScore(value, decimals = 1) {
    if (value == null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return null;
    const factor = 10 ** decimals;
    return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

async function fetchRating(fullName) {
    const endpoint = "https://www.ratemyprofessors.com/graphql";
    const schoolID = "U2Nob29sLTEzNQ=="; // BYU (Change to U2Nob29sLTE0NDI= for UVU)
    const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic d2ViOndlYg==',
        'Referer': 'https://www.ratemyprofessors.com/',
    };

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
                headers: requestHeaders,
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
                                        teacherRatingTags {
                                            tagName
                                            tagCount
                                        }
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

            debugLog("rmpSearch result:", result);

            if (!result || !result.data || !result.data.newSearch) return [];
            return result.data.newSearch.teachers.edges;
        } catch (err) {
            console.error("GraphQL Fetch Error:", err);
            return [];
        }
    };

    // INTERNAL HELPER: Fetch full teacher details by global node id
    const fetchTeacherDetails = async (teacherId) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({
                    "query": `query TeacherDetailsById($id: ID!) {
                        node(id: $id) {
                            __typename
                            ... on Teacher {
                                id
                                firstName
                                lastName
                                avgRatingRounded
                                avgDifficultyRounded
                                wouldTakeAgainPercentRounded
                                numRatings
                                department
                                teacherRatingTags {
                                    tagName
                                    tagCount
                                }
                                ratings(first: 100) {
                                    edges {
                                        node {
                                            ratingTags
                                        }
                                    }
                                }
                            }
                        }
                    }`,
                    "variables": {
                        "id": teacherId
                    }
                })
            });

            const result = await response.json();
            const teacherNode = result?.data?.node;
            if (!teacherNode || teacherNode.__typename !== "Teacher") return null;
            return teacherNode;
        } catch (err) {
            console.error("Teacher detail fetch error:", err);
            return null;
        }
    };

    const fetchTeacherTagLookup = async () => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({
                    "query": `query TeacherTagsLookup {
                        teacherTags {
                            id
                            name
                        }
                    }`
                })
            });

            const result = await response.json();
            const tags = result?.data?.teacherTags;
            if (!Array.isArray(tags)) return new Map();

            const lookup = new Map();
            for (const tag of tags) {
                if (tag?.id && tag?.name) {
                    lookup.set(String(tag.id), tag.name);
                }
            }
            return lookup;
        } catch (err) {
            console.error("Teacher tag lookup fetch error:", err);
            return new Map();
        }
    };

    const buildTagsFromRatings = (ratingEdges, teacherTagLookup = new Map()) => {
        if (!Array.isArray(ratingEdges)) return [];

        const tagCounts = new Map();
        for (const edge of ratingEdges) {
            const raw = edge?.node?.ratingTags;
            if (!raw || typeof raw !== "string") continue;

            // RMP returns rating tags in different formats depending on endpoint/history.
            // Support:
            // - "--1--2--" (delimited IDs)
            // - "1,2" (comma-separated IDs)
            // - '["1","2"]' (JSON array)
            let fromDelimited = [];
            if (raw.trim().startsWith("[")) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        fromDelimited = parsed.map(String);
                    }
                } catch (jsonErr) {
                    // Ignore parsing failure and fall through to delimiter heuristics.
                }
            }

            if (fromDelimited.length === 0) {
                fromDelimited = raw.includes("--")
                    ? raw.split("--")
                    : raw.split(",");
            }

            const tags = fromDelimited
                .map(t => t.trim())
                .filter(Boolean);

            for (const tagToken of tags) {
                const mappedName = teacherTagLookup.get(tagToken) || tagToken;
                tagCounts.set(mappedName, (tagCounts.get(mappedName) || 0) + 1);
            }
        }

        return [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([tagName, tagCount]) => ({ tagName, tagCount }));
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

        let node = bestMatch.node;
        const detailedNode = await fetchTeacherDetails(node.id);
        if (detailedNode) {
            node = detailedNode;
        }
        const teacherTagLookup = await fetchTeacherTagLookup();
        // 1. Decode the "weird code" (Base64)
        // "VGVhY2hlci0yNzExMDk3" becomes "Teacher-2711097"
        const decodedId = atob(node.id); 
        // 2. Extract just the numbers
        const legacyId = decodedId.split('-')[1];

        // 1. Sort tags by frequency (highest count first)
        const apiTags = node.teacherRatingTags 
            ? [...node.teacherRatingTags].sort((a, b) => b.tagCount - a.tagCount)
            : [];
        const fallbackTags = buildTagsFromRatings(node?.ratings?.edges, teacherTagLookup);
        const sortedTags = apiTags.length > 0 ? apiTags : fallbackTags;

        const normalizedRating =
            normalizeScore(node.avgRatingRounded) ?? normalizeScore(node.avgRating);
        const normalizedDifficulty =
            normalizeScore(node.avgDifficultyRounded) ?? normalizeScore(node.avgDifficulty);

        return {
            rating: normalizedRating ?? "N/A",
            difficulty: normalizedDifficulty ?? "N/A",
            wouldTakeAgain: node.wouldTakeAgainPercentRounded > 0
                ? `${Math.round(node.wouldTakeAgainPercentRounded)}%`
                : (node.wouldTakeAgainPercent > 0 ? `${Math.round(node.wouldTakeAgainPercent)}%` : "N/A"),
            numRatings: node.numRatings || 0,
            tags: sortedTags.map(t => t.tagName), 
            department: node.department || "N/A",
            url: `https://www.ratemyprofessors.com/professor/${legacyId}`,
            matchedName: `${node.firstName} ${node.lastName}`
        };

    } catch (error) {
        console.error("Scrape Process Error:", error);
        return { rating: "Error", message: error.message };
    }
}