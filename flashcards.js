let COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
let GAP = document.querySelector('.card:last-child').offsetWidth + 16;
const ANIMATION_TIMING = 150;

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
function flipCardEvent(evt) {
    flipCard(evt.currentTarget);
}

function renderFace(side, content, properties) {
    const face = document.createElement('div');
    face.classList.add('card-face');
    face.classList.add(side);

    Object.entries(properties).forEach(([propertyName, propertyValue]) => {
        if (propertyName === 'class' || propertyName === 'value') {
            console.error(`Invalid card property: setting ${propertyName} this way can cause unintended consequences`);
        }
        face.setAttribute(propertyName, propertyValue.toString());
    });
    face.innerText = content;
    return face;
}
function renderCard(frontSide, backSide, index) {
    /*
    Returns an HTMLElement that looks like this:
    <div class="card" data-index="0">
        <button class="card-flipper">/<button>
        <div class="buttons">
            <button class="button button-edit"><i class="fa-solid fa-paragraph"></i></button>
            <button class="button button-delete"><i class="fa-solid fa-trash-can"></i></button>
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
                        <button class="button button-edit" disabled title="edit" aria-pressed="false" aria-label="edit this card"><i class="fa-solid fa-paragraph"></i></button>\
                        <button class="button button-delete" disabled title="delete" aria-pressed="false" aria-label="delete this card"><i class="fa-solid fa-trash-can"></i></button>\
                     </div>'

    card.prepend(button);
    card.append(renderFace('front', frontSide, {lang: 'fr'}),
                renderFace('back', backSide, {lang: 'en'}));

    if (index !== undefined) {
        card.setAttribute('data-index', index);
    }

    return card;
}

class CardSet extends DocumentFragment{
    constructor(cards, properties) {
        super();
        let defaultProp = {
            title: 'new flashcard set',
            columns: COLUMNS,
            gap: GAP,
            numCards: 0
        }
        this.prop = properties;
    }

    createCard(card) {
        const newCard = renderCard(card[0], card[1], this.prop.numCards);
        newCard.addEventListener('click', flipCardEvent);
        this.prop.numCards += 1;
        return newCard;
    }

    appendCards(...cards) {
        // creates cards from multiple arrays of text and adds them to the end of the document fragment
        this.append(...cards.map(this.createCard));
    }

    prependCards(...cards) {
        // creates cards from multiple arrays of text and adds them to the beginning of the document fragment
        this.prepend(...cards.map(this.createCard));
    }
}

function createCardList(...cards) {  //TODO: refactor this into CardSet
    // returns a DocumentFragment containing cards created from the parameters
    const list = new DocumentFragment();
    cards.forEach(([front, back], index) => {
        const newCard = renderCard(front, back, index)
        list.appendChild(newCard);
        newCard.addEventListener('click', flipCardEvent);
    });
    return list;
}

/*
TODO: rewrite with drag events: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
For the card being dragged:
    'dragstart' - fires when the user starts to drag an element
    'drag' - fires every 350ms when the user is dragging an element
    'dragend' fires when the user has finished dragging the element
For the movable cards: 'ondragover' 'ondragleave'
    'dragover' - fires when the dragged element is over the drop target
 */

// Allows the clicked card to be dragged
function startDragEvent (evt) {
    const card = evt.currentTarget;
    if (card.classList.contains('editable') || evt.target.classList.contains('button')) {
        return;
    }
    const set = card.parentElement;
    const cards = set.querySelectorAll('.card:not(.card-settings)');
    const setRect = set.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    // an array that tracks the DOMElement in each position.
    // initialized to [0, 1, 2, ...]
    let elemIndexes = Array.from({length: cards.length}, (pos, index) => index);
    // calculate the maximum translation allowed (relative to this card)
    const boundary = new DOMRect(setRect.x - cardRect.x, setRect.y - cardRect.y,
                            setRect.right - cardRect.right, setRect.bottom - cardRect.bottom);
    // save the 'mousemove' event callback function so that we can remove the event listener later
    const tracker = dragCard.bind(null, evt.screenX, evt.screenY, card, cards, set, elemIndexes, boundary);
    // 'moving' class adds style and prevents other actions from occurring (flipping the card)
    card.classList.toggle('moving');

    let timer = new Date();
    document.addEventListener('mousemove', tracker);
    document.addEventListener('mouseup', finishDrag.bind(null, evt.screenX, evt.screenY, card, cards, set, timer, tracker), {once: true});
}

/* Defines the behavior of the card being dragged:
    - The card follows the mouse as long as the mouse is within bounds
    - When the dragged card overlaps another card, the overlapped card is moved to the open slot left by the dragged card
*/
function dragCard(mouseStartX, mouseStartY, card, cards, set, elemIndexes, boundary, evt) {
    // evt.stopPropagation();
    // the held card should be pinned to the mouse
    const pinX = squish(evt.screenX - mouseStartX, boundary.left, boundary.width);
    const pinY = squish(evt.screenY - mouseStartY, boundary.top, boundary.height);

    card.style.transform = `translate3d(${pinX}px, ${pinY}px, 0)`;

    // find the nearest slot so that we can evict the current tenant
    const prevSlot = readInt(card, 'data-last', 'data-index'); // the last slot the grabbed card occupied
    const nextSlot = getClosestSlot(card.offsetLeft + pinX, card.offsetTop + pinY); // the slot closest to the card's current position

    // don't evict self or neighbors that do not exist
    if (prevSlot === nextSlot
        || 0 > nextSlot || nextSlot >= cards.length) {
        return;
    }
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

// Cleans up after startDragEvent and updates the DOM with the new positions of the cards
function finishDrag(mouseX, mouseY, card, cards, set, startTime, tracker, evt) {
    // disregard short clicks
    let finishTime = new Date();
    const tooLong = 300; // any drags that take more ms than this are considered long
    const range = 10; // any drags that cover more distance than this are considered long
    if ((finishTime - startTime < tooLong)
        && (Math.pow(mouseX - evt.screenX, 2) + Math.pow(mouseY - evt.screenY, 2) < Math.pow(range, 2))) {

        // reset the DOM
        card.classList.toggle('moving');
        cards.forEach((card) => {
            card.removeAttribute('style');
        });
    } else {
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
        card.classList.toggle('moving');
    }

    evt.currentTarget.removeEventListener('mousemove', tracker);
}


// The new card form creates a new card on submit
function createCardEvent(evt) {
    evt.preventDefault();
    const form = evt.currentTarget;
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

        // insert the new card
        set.insertBefore(newCard, form.parentElement);
        // animate
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

/* When the modify button is pressed, allow all the cards to be repositioned, edited, or deleted */
function editCardEvent(evt) {
    const card = evt.currentTarget.parentElement;
    // delete button pressed
    if (evt.target.classList.contains('button-delete')) {
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

    } else if (evt.target.classList.contains('button-edit')) {
        // edit button pressed
        card.classList.toggle('editable');
        evt.target.setAttribute('aria-pressed', (evt.target.getAttribute('aria-pressed') === 'false').toString());
        card.querySelectorAll('.card-face').forEach(face => {
            face.contentEditable = (!face.isContentEditable).toString();
        });
    }
}
function toggleModifyCard(card) {
    card.classList.remove('flipped');  // un-flip the cards
    card.firstElementChild.toggleAttribute('disabled');  // disable the card flip button
    const tools = card.querySelector('.modify-tools');
    // toggle the 'modifying' class and the event listeners
    if (card.classList.contains('modifying')) {
        card.classList.remove('modifying');
        card.removeEventListener('mousedown', startDragEvent);
        card.addEventListener('click', flipCardEvent);
        tools.removeEventListener('click', editCardEvent);
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
function modifyCardsEvent(evt) {
    // flip the button
    const button = evt.currentTarget;
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
        GAP = document.querySelector('.card').offsetWidth + 16;
    }, delay);
})