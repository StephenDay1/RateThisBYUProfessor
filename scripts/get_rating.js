function get_rating(elements) {
    console.log("Available professors:");
    elements.forEach(element => {
        professorName = element.textContent;
        if (professorName != "TBD") {
            
            // This would eventually be the actual query
            
            score = professorName[0].toLowerCase() < 'f' ? 5 : professorName[0].toLowerCase() < 'q' ? 3.5 : 1.5;
            console.log(professorName + ": " + score);

            // Make it look pretty!
            color = score > 4 ? "#7ff6c3" : score > 3 ? "#fff170" : "#ff9c9c";

            element.style.backgroundColor = "#f7f7f7";
            element.style.borderRadius = "4px";
            element.style.padding = "4px 1px 4px 4px";
            element.style.borderLeft = `5px solid ${color}`;
            element.style.cursor = "pointer";
            
        }
    });
}

console.log("Rate This BYU Professor is active!");
// Wait 5 seconds.
setTimeout(() => {
    const fragment = window.location.hash.substring(1);
    console.log(typeof(fragment));
    if (fragment == "/") {
        // Home page
        console.log("Getting scores for your professors");
        get_rating(document.querySelectorAll(".cdSectionRoot > :nth-child(3)"));
    } else if (fragment.includes("chooseASection")) {
        // In class selection
        console.log("Getting scores for available professors");
        get_rating(document.querySelectorAll(".sectionDetailsCol > h4"));
    }


}, 5000);

