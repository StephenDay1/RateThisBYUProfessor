const queryURL = 'https://www.ratemyprofessors.com/search/professors/?q=';
const teacherCardClass = 'TeacherCard__InfoRatingWrapper-syjs0d-3';

async function findProfessor(name) {
    const queryName = name.replaceAll(' ', '%20');

    console.log((queryName));
    // const resultsPage = fetch(queryURL + queryName);
    // console.log(resultsPage)
    // resultsPage.text().then((html) => {
    //     const parser = new DOMParser();
    //     const doc = parser.parseFromString(html, 'text/html');
    //     const teacherCards = doc.getElementsByClassName(teacherCardClass);
    //     if (teacherCards.length > 0) {
    //         const rating = teacherCards[0].getElementsByClassName('Rating__RatingNumber-syjs0d-2')[0].textContent;
    //         console.log(`Rating for ${name}: ${rating}`);
    //     } else {
    //         console.log(`No results found for ${name}`);
    //     }
    // });
}