let COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
let GAP = document.querySelector('.card:last-child').offsetWidth + 16;
const ANIMATION_TIMING =  parseInt(getComputedStyle(document.body).getPropertyValue('--animation-speed').slice(0, -2));


/* helper functions */

function readInt(elem, ...attributes) {
    // returns an attribute value as an integer.
    // if the first attribute does not exist, return the value of the second, and so on...
    const firstValidAttribute = attributes.find(attempt => {
        return (elem.getAttribute(attempt) !== null);
    });
    if (firstValidAttribute === undefined) {
        return undefined;
    }
    return parseInt(elem.getAttribute(firstValidAttribute));
}
function toPx(value) {
    /* converts a value to a string and appends 'px' to the end */
    return value.toString() + 'px';
}
function squish(num, min, max) {
    // returns the value closest to 'num' within a boundary that slightly exceeds 'min' and 'max'
    // when num surpasses the boundary, the excess is logarithmically reduced for smooth transition

    function boundingFn(overflow) {
        // wrapper function that determines how the excess is reduced
        return Math.log(overflow + 1);
    }

    if (num > max) {
        return max + boundingFn(num-max);
    }
    if (num < min) {
        return min - boundingFn(min-num);
    }
    return num;
}
function clamp(num, min, max) {
    // returns the value closest to num while remaining within the boundary defined by min and max
    return Math.min(Math.max(num, min), max);
}

function getSlotRect(index) {
    // returns a DOMRect representing a slot's location relative to the cardset container
    return new DOMRect((GAP) * (index % COLUMNS),
        (GAP) * Math.floor(index / COLUMNS),
        GAP, GAP);
}
function getClosestSlot(x, y) {
    // returns the index of the slot closest to the point (x, y) relative to the cardset container
    return Math.round(x / GAP) + COLUMNS * Math.round(y / GAP);
}
function readCards(setElem) {
    let cards = [];
    setElem.querySelectorAll('.card:not(.card-settings)').forEach(card => {
        const cardElem = card.querySelectorAll('.card-face');
        cards.push([cardElem[0].innerText.trim(), cardElem[1].innerText.trim()]);
    });
    return cards;
}
function exportCards(setElem, faceSeparator, cardSeparator) {
    return readCards(setElem).reduce((total, cardText, index, set) => {
        if (index < set.length - 1) {
            return total + cardText[0] + faceSeparator + cardText[1] + cardSeparator;
        } else { // don't print a cardSeparator after the last card
            return total + cardText[0] + faceSeparator + cardText[1];
        }
    }, '');
}
function importCards(cardString, faceSeparator, cardSeparator) {
    const cards = cardString.split(cardSeparator);
    return cards.map((card, index) => {
        const faces = card.split(faceSeparator);
        if (faces.length !== 2){
            console.error(`${this.name} failed: Incorrectly formatted data: each card must have two faces. Card ${index} has ${faces.length}: ${faces}`);
        }
        return faces;
    })
}

function slideCard(card, distX, distY) {
    // Plays and returns an animation where the card moves to its original position from (distX, distY)
    const flipped = card.classList.contains('flipped') ? ' rotateY(180deg)' : '';
    const translate = [{transform: `translate3d(${toPx(distX)}, ${toPx(distY)}, 0)` + flipped},
        {transform: `translate3d(0, 0, 0)` + flipped}];
    return card.animate(translate, ANIMATION_TIMING);
}
function shrinkCard(card) {
    // Plays and returns an animation where the card shrinks completely after being removed from the normal flow
    card.style.left = toPx(card.offsetLeft);
    card.style.top = toPx(card.offsetTop);
    card.style.width = toPx(card.offsetWidth);
    card.style.height = toPx(card.offsetHeight);
    card.style.position = 'absolute';
    const animation = card.animate([{transform: 'scale(1)'}, {transform: 'scale(0)'}], ANIMATION_TIMING);
    animation.finished.then(value => {
        card.removeAttribute('style');
        return value;
    });
    return animation;
}
function growCard(card) {
    // Inserts a card into the normal flow and then plays and returns an animation where the card grows from nothing
    card.classList.remove('hidden');
    const grow = [{transform: `scale(0)`},
                  {transform: 'scale(1)'}];
    return card.animate(grow, ANIMATION_TIMING);
}
function flipCard(card) {
    card.classList.toggle('flipped');
}

function renderFace(side, content, properties) {
    const face = document.createElement('div');
    face.classList.add('card-face');
    face.classList.add(side);

    const text = document.createElement('p');
    text.innerText = content;

    Object.entries(properties).forEach(([propertyName, propertyValue]) => {
        if (propertyName === 'class' || propertyName === 'value') {
            console.error(`Invalid card property: setting ${propertyName} this way can cause unintended consequences`);
        }
        text.setAttribute(propertyName, propertyValue.toString());
    });
    face.append(text);

    return face;
}
function renderCard(frontSide, backSide, index) {
    /*
    Returns an HTMLElement that looks like this:
    <div class="card" data-index="0">
        <button class="card-flipper">/<button>
        <div class="buttons">
            <button class="button button-edit"><i class="las la-edit"></i></button>
            <button class="button button-delete">i class="las la-trash-alt"></i></button>
        </div>
        <div class="front" lang="fr">french side</div>
        <div class="back" lang="en">english side</div>
    </div>
     */
    const card = document.createElement('div');
    card.classList.add('card');

    const button = document.createElement('button');
    button.classList.add('card-flipper');

    card.innerHTML = '<div class="modify-tools" aria-expanded="false">\
                        <button class="button button-edit" disabled aria-pressed="false" aria-label="edit this card"><i class="las la-pen-alt la-lg"></i></button>\
                        <button class="button button-delete" disabled aria-pressed="false" aria-label="delete this card"><i class="las la-trash-alt la-lg"></i></button>\
                     </div>'

    card.prepend(button);
    card.append(renderFace('front', frontSide, {lang: 'fr'}),
                renderFace('back', backSide, {lang: 'en'}));

    if (index !== undefined) {
        card.setAttribute('data-index', index);
    }

    return card;
}
function createCardList(...cards) {
    // returns a DocumentFragment containing cards created from the parameters
    const list = new DocumentFragment();
    cards.forEach(([front, back], index) => {
        const newCard = renderCard(front, back, index)
        list.appendChild(newCard);
        newCard.addEventListener('click', flipCardEvent);
    });
    return list;
}


/* Event Handling */
function flipCardEvent(clickEvent) {
    flipCard(clickEvent.currentTarget);
}

// cards can be dragged and repositioned during editing mode
function startDragEvent (mouseDownEvent) {
    // prepares a card to be dragged
    const card =  mouseDownEvent.currentTarget;
    if (card.classList.contains('editable') ||  mouseDownEvent.target.classList.contains('button')) {
        return;
    }
    const set = card.parentElement;
    const cards = set.querySelectorAll('.card:not(.card-settings)');
    const setRect = set.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    // track the DOMElement in each position throughout the lifetime of the drag. initialized to [0, 1, 2, ...]
    let elemIndexes = Array.from({length: cards.length}, (pos, index) => index);
    // calculate the maximum translation allowed (relative to this card)
    const boundary = new DOMRect(setRect.x - cardRect.x, setRect.y - cardRect.y,
                            setRect.right - cardRect.right, setRect.bottom - cardRect.bottom);
    card.classList.toggle('moving');

    // move the card when the mouse moves
    function dragCard(mouseMoveEvent) {
        /* Defines the behavior of the card being dragged:
            - The card follows the mouse as long as the mouse is within bounds
            - When the dragged card overlaps another card, the overlapped card is moved to the open slot left by the dragged card
        */
        // pin the held card to the mouse
        const pinX = squish(mouseMoveEvent.screenX - mouseDownEvent.screenX, boundary.left, boundary.width);
        const pinY = squish(mouseMoveEvent.screenY - mouseDownEvent.screenY, boundary.top, boundary.height);
        card.style.transform = `translate3d(${pinX}px, ${pinY}px, 0)`;

        // find the nearest slot so that we can evict the current tenant
        const prevSlot = readInt(card, 'data-last', 'data-index'); // the last slot the grabbed card occupied
        const nextSlot = getClosestSlot(card.offsetLeft + pinX, card.offsetTop + pinY); // the slot closest to the card's current position

        // don't evict self or neighbors that do not exist
        if (prevSlot === nextSlot || 0 > nextSlot || nextSlot >= cards.length) { return; }

        const neighbor = cards[elemIndexes[nextSlot]];
        // record the new indexes of cards so that we can still find the DOM element later
        elemIndexes[nextSlot] = readInt(card, 'data-index');
        elemIndexes[prevSlot] = readInt(neighbor, 'data-index');
        // swap data-last
        card.setAttribute('data-last', nextSlot.toString());
        neighbor.setAttribute('data-last', prevSlot.toString());
        // move the neighboring card to the open space left by the grabbed card
        const openSlot = getSlotRect(prevSlot);
        neighbor.style.transform = `translate3d(${openSlot.x - neighbor.offsetLeft}px, ${openSlot.y - neighbor.offsetTop}px, 0)`;
    }
    document.addEventListener('mousemove', dragCard);

    const startTime = new Date(); // used to track how long the user held the mouse down
    // stop the card and update the DOM when the user releases the mouse
    function finishDrag(mouseUpEvent) {
        // Clean up after startDragEvent and update the DOM with the new positions of the cards when the mouse button is released
        let finishTime = new Date();
        const minTime = 300; // any drags that take more ms than this are considered long
        const minDist = 10; // any drags that cover more distance than this are considered long
        // disregard short clicks
        if ((finishTime - startTime < minTime) && (Math.pow(mouseUpEvent.screenX - mouseDownEvent.screenX, 2) + Math.pow(mouseUpEvent.screenY - mouseDownEvent.screenY, 2) < Math.pow(minDist, 2))) {
            // reset the DOM when the click is too short
            cards.forEach((card) => {
                card.removeAttribute('style');
            });
        } else {
            // when the click is long enough reorganize the DOM according to the new order
            // find the new order of the elements
            let correctOrder = Array.from(cards).sort((a, b) => {
                if (readInt(a, 'data-last') > readInt(b, 'data-last')) {
                    return 1;
                } else {
                    return -1;
                }
            });

            // remove temp styling and update DOM index data
            correctOrder.forEach((card, index) => {
                card.setAttribute('data-index', index);
                card.removeAttribute('style');
                card.removeAttribute('data-last');
            })

            // update the DOM
            set.prepend(...correctOrder);
            card.removeAttribute('data-last');
        }

        // release the dragged card
        card.classList.toggle('moving');
        document.removeEventListener('mousemove', dragCard);
    }
    document.addEventListener('mouseup', finishDrag, {once: true, passive: true});
}

// Handles submit events for the create card form
function createCardEvent(submitEvent) {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const frontInputElem = form.querySelector('.front-input');
    const frontInput = frontInputElem.value.trim();
    const backInput = form.querySelector('.back-input').value.trim();
    const set = form.parentElement.parentElement;

    // only add a new card when the form is valid and the set is in modify mode
    if (frontInput && backInput && set.querySelector('.modify.flipped')) {
        const newCard = renderCard(frontInput, backInput, set.querySelectorAll('.card:not(.card-settings)').length.toString());
        // update the new Card's values so that it behaves under modify mode (renderCard assumes modify mode is off)
        newCard.classList.add('modifying');
        newCard.firstElementChild.toggleAttribute('disabled');  // disable the card flip button
        newCard.addEventListener('mousedown', startDragEvent);
        // make the edit and delete buttons clickable
        const tools = newCard.querySelector('.modify-tools');
        for (tool of tools.children) {
            tool.removeAttribute('disabled');
        }
        tools.addEventListener('click', editCardEvent);

        // insert the new card and animate it growing
        set.insertBefore(newCard, form.parentElement);
        growCard(newCard);

        // the cards after the new one get pushed to the right--animate it with FLIP
        const numberOfCards = set.querySelectorAll('.card:not(.card-settings)').length;
        const buttons = set.querySelectorAll('.card-settings');
        buttons.forEach((button, index) => {
            const dest = getSlotRect(index + numberOfCards - 1);
            const src = getSlotRect(index + numberOfCards);
            slideCard(button, dest.x - src.x, dest.y - src.y);
        });

        frontInputElem.focus();
        form.reset();
    }
}
document.querySelectorAll('.create form').forEach(form => {
    form.addEventListener('submit', createCardEvent);
});

// Handles click events for the modification buttons (edit, delete) on each card
function editCardEvent(clickEvent) {
    const card = clickEvent.currentTarget.parentElement;
    // delete button pressed
    if (clickEvent.target.classList.contains('button-delete')) {
        // shrink the card to be deleted
        const cardIndex = readInt(card, 'data-index');
        shrinkCard(card).finished.then( function() {
                card.remove();  // update the DOM after the shrink animation has finished
            });

        // move all the cards after the deleted card
        const set = card.parentElement;
        const cards = set.querySelectorAll('.card');
        cards.forEach((card, index) => {
            if (index <= cardIndex) {
                return;
            }
            const newPos = getSlotRect(index - 1);
            const oldPos = getSlotRect(index);
            slideCard(card, oldPos.x - newPos.x, oldPos.y - newPos.y)
            card.setAttribute('data-index', (index - 1).toString());
        });

    } else if (clickEvent.target.classList.contains('button-edit')) {
        // edit button pressed
        card.classList.toggle('editable');
        clickEvent.target.setAttribute('aria-pressed', (clickEvent.target.getAttribute('aria-pressed') === 'false').toString());
        card.querySelectorAll('.card-face p').forEach(face => {
            face.contentEditable = (!face.isContentEditable).toString();
        });
    }
}

function toggleModifyCard(card) {
    /* transform a card into modification mode by
     - showing both faces at once
     - displaying the edit and delete buttons
     - allowing the card to be dragged */
    card.classList.remove('flipped');  // un-flip the cards
    card.firstElementChild.toggleAttribute('disabled');  // disable the card flip button
    const tools = card.querySelector('.modify-tools');
    // toggle the 'modifying' class and the event listeners
    if (card.classList.contains('modifying')) {
        card.classList.remove('modifying');
        card.removeEventListener('mousedown', startDragEvent);
        card.addEventListener('click', flipCardEvent);
        tools.removeEventListener('click', editCardEvent);
        // undo the edit state if the edit button was pressed
        if (card.classList.contains('editable')) {
            card.classList.remove('editable');
            card.querySelectorAll('p[contenteditable="true"]').forEach(elem => {
                elem.removeAttribute('contenteditable');
            });
            tools.firstElementChild.setAttribute('aria-pressed', 'false');
        }
    } else {
        card.classList.add('modifying');
        card.addEventListener('mousedown', startDragEvent);
        card.removeEventListener('click', flipCardEvent);
        tools.addEventListener('click', editCardEvent);
    }
    // update the aria-expanded attribute
    tools.setAttribute('aria-expanded', (tools.getAttribute('aria-expanded') !== "true").toString());
    // toggle the selectablilty of the tools
    for (tool of tools.children) {
        tool.toggleAttribute('disabled');
    }
}

// When the modify button is pressed, allow all the cards to be repositioned, edited, or deleted
function modifyCardsEvent(clickEvent) {
    // flip the button
    const button = clickEvent.currentTarget;
    const newCardForm = button.previousElementSibling;
    const set = button.parentElement;
    const numCards = set.childElementCount;
    const state = button.classList.contains('flipped');

    flipCard(button);
    // toggle the create card form
    if (state) {
        // hide the form
        shrinkCard(newCardForm).finished.then(function() {
            newCardForm.classList.add('hidden');
        });
        const newPos = getSlotRect(numCards - 2);
        const oldPos = getSlotRect(numCards - 1);
        slideCard(button, oldPos.x - newPos.x, oldPos.y - newPos.y);
    } else {
        // show the form
        growCard(newCardForm);
        const newPos = getSlotRect(numCards - 1);
        const oldPos = getSlotRect(numCards - 2);
        slideCard(button, oldPos.x - newPos.x, oldPos.y - newPos.y);
    }

    // toggle the modification state of all the cards in the set
    button.parentElement.querySelectorAll('.card:not(.card-settings)').forEach(toggleModifyCard);
}
document.querySelectorAll('.modify').forEach( button => {
    button.addEventListener('click', modifyCardsEvent);
});


// Add click listeners for existing cards in the DOM
document.querySelectorAll('.card:not(.card-settings)').forEach(card => {
    card.addEventListener('click', flipCardEvent);
});

// Create the initial cards
const grid = document.querySelector('.flash-cards');
const data = [['de rien', "it's ok"],
              ['je vous en prie', "don't mention it"],
              ["je t'en prie", "you're welcome"]];
grid.prepend(createCardList(...data));

// Update global constants COLUMNS and GAP when the window resizes
let timer = null;
window.addEventListener('resize', function() {
    const delay = 500 // when the window resizes multiple times in 500 ms, nothing happens

    // reset timer
    clearTimeout(timer);
    timer = setTimeout(function() {
        COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
        GAP = document.querySelector('.card:last-child').offsetWidth + 16;
    }, delay);
});
