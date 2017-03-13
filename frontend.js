function displayQuote(quote) {

    const section = document.createElement('a');
    section.className = 'quote-container';
    section.target = '_blank';
    section.href = quote.url;

    const link = document.createElement('p');
    link.className = 'goodreads-link';
    link.textContent = `Quote from ${quote.website}`;
    section.appendChild(link);

    const quoteElement = document.createElement('p');
    quoteElement.textContent = `"${quote.quote}"`;
    quoteElement.className = 'quote';
    section.appendChild(quoteElement);

    const authorElemet = document.createElement('p');
    authorElemet.textContent = `~ ${quote.author}`;
    authorElemet.className = 'author';
    section.appendChild(authorElemet);

    document.body.appendChild(section);
}

function displayBackgroundImage(image_data) {
    const image = new Image();

    image.src = image_data.img_src;
    image.className = 'background-image';
    image.alt = image_data.title;
    image.title = image_data.title;

    const imageInfo = document.createElement('a');
    imageInfo.href = image_data.redditlink;
    imageInfo.textContent = image_data.copyright;
    imageInfo.className = 'background-image-info';
    imageInfo.target = '_blank';

    document.body.appendChild(image).onload = elm => {
        elm.target.className += ' loaded';
    };

    document.body.appendChild(imageInfo);
}


function onError(error) {
    console.log(error);
}


browser.runtime.sendMessage({ action: "GET_BACKGROUND_IMAGE" }).then(displayBackgroundImage, onError);
browser.runtime.sendMessage({ action: "GET_QUOTE" }).then(displayQuote, onError);

