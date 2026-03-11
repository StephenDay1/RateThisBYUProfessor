function get_rating(elements) {
    console.log("Available professors:");
    elements.forEach(element => {
        professorName = element.textContent;
        if (professorName != "TBD") {
            console.log(professorName);
        }
    });
}

console.log("Rate This BYU Professor is active!");
// Wait 5 seconds.
setTimeout(() => {
    get_rating(document.querySelectorAll(".sectionDetailsCol > h4"));
}, 5000);

