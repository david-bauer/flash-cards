const grid = document.querySelector('.flash-cards');
let COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
let GAP = document.querySelector('.card').offsetWidth + 16;
const ANIMATION_TIMING = 150;

function createCard(frontSide, backSide, index) {
    /*
    Returns an HTMLElement that looks like this:
    <div class="card" data-index="0">
        <div class="buttons">
            <button class="button button-edit"><i class="fa-solid fa-paragraph"></i></button>
            <button class="button button-delete"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <div class="front">
            <p lang="fr">de rien</p>
        </div>
        <div class="back">
            <p lang="en">it's ok</p>
        </div>
    </div>
     */
    const card = document.createElement('div');
    card.classList.add('card');
    card.innerHTML = '<div class="buttons">' +
                        '<button class="button button-edit"><i class="fa-solid fa-paragraph"></i></button>' +
                        '<button class="button button-delete"><i class="fa-solid fa-trash-can"></i></button>' +
                     '</div>'

    function createSide(side, content, properties) {
        const wrapper = document.createElement('div');
        wrapper.classList.add(side);
        const p = document.createElement('p');

        Object.entries(properties).forEach(([propertyName, propertyValue]) => {
            p.setAttribute(propertyName, propertyValue.toString());
        });
        p.innerText = content;
        wrapper.appendChild(p);
        return wrapper;
    }

    card.append(createSide('front', frontSide, {lang: 'fr'}),
                createSide('back', backSide, {lang: 'en'}));

    if (index !== undefined) {
        card.setAttribute('data-index', index);
    }

    return card;
}


function createCardList(...cards) {
    // returns a DocumentFragment containing cards created from the parameters
    const list = new DocumentFragment();
    cards.forEach(([front, back], index) => {
        const newCard = createCard(front, back, index)
        list.appendChild(newCard);
        newCard.addEventListener('click', clickCard);
        newCard.addEventListener('mousedown', startDrag);
    });
    return list;
}

function clickCard(evt) {
    const card = evt.currentTarget;
    if (evt.target.classList.contains('button-delete')) {
        // delete button pressed
        const gap = card.offsetWidth + 16;
        function getRectFromSlotIndex(index) {
            // returns a DOMRect representing the location and size of a slot, given the slot's index
            return new DOMRect((gap) * (index % COLUMNS),
                (gap) * Math.floor(index / COLUMNS),
                gap, gap);
        }

        // shrink the card to be deleted
        card.classList.add('removed');
        // move all the cards after the deleted card one position up
        const cardIndex = readInt(evt.currentTarget, 'data-index');
        const set = card.parentElement;
        const cards = set.querySelectorAll('.card');
        cards.forEach((card, index) => {
            if (index <= cardIndex) {
                return;
            }
            const newPos = getRectFromSlotIndex(index);
            const oldPos = getRectFromSlotIndex(index - 1);
            const flipped = card.classList.contains('flipped') ? ' rotateY(180deg)' : '';
            const translate = [{transform: `translate3d(0, 0, 0)` + flipped},
                               {transform: `translate3d(${oldPos.x - newPos.x}px, ${oldPos.y - newPos.y}px, 0)` + flipped}];
            card.animate(translate, ANIMATION_TIMING);
            card.setAttribute('data-index', (index - 1).toString());
        });
        // update the DOM after the transition has finished
        setTimeout(function() {
            card.remove();
        }, ANIMATION_TIMING);
    } else if (evt.target.classList.contains('button-edit')) {
        // edit button pressed

    } else if (['input', 'button'].some(type => evt.target.nodeName.toLowerCase() === type)) {
        // form element pressed

    } else if (card.classList.contains('moving')) {
        // don't flip cards while they are moving
        card.classList.remove('moving');
    } else {
        card.classList.toggle('flipped');
    }
}

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

function getSlotRect(index) {
    // returns a DOMRect representing the location and size of a slot, given the slot's index
    return new DOMRect((GAP) * (index % COLUMNS),
        (GAP) * Math.floor(index / COLUMNS),
        GAP, GAP);
}

function getClosestSlot(x, y) {
    // returns the index of the slot closest to the DOMRect
    return Math.round(x / GAP) + COLUMNS * Math.round(y / GAP);
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


// Triggered on 'mousedown' event. Records the necessary data
function startDrag (evt) {
    // only make the card draggable if the modify mode is on
    if (!evt.currentTarget.classList.contains('modifying') || evt.target.classList.contains('button')) {
        return;
    }
    const card = evt.currentTarget;
    const set = card.parentElement;
    const cards = set.querySelectorAll('.card:not(.button)');
    const setRect = set.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    // an array that tracks the DOMElement in each position.
    // initialized to [0, 1, 2, ...]
    let elemIndexes = [...Array(cards.length)].map((pos, index) => {
        return index;
    });
    // calculate the maximum translation allowed (relative to this card)
    const boundary = new DOMRect(setRect.x - cardRect.x, setRect.y - cardRect.y,
                            setRect.right - cardRect.right, setRect.bottom - cardRect.bottom);
    // save the 'mousemove' event callback function so that we can remove the event listener later
    const tracker = dragCard.bind(null, evt.screenX, evt.screenY, card, card.classList.contains('flipped'), cards, set, elemIndexes, boundary);
    // 'moving' class adds style and prevents other actions from occurring (flipping the card)
    card.classList.toggle('moving');

    let timer = new Date();
    document.addEventListener('mousemove', tracker);
    document.addEventListener('mouseup', finishDrag.bind(null, evt.screenX, evt.screenY, card, cards, set, timer, tracker), {once: true});
}

// Defines the behavior of the card being dragged
function dragCard(mouseStartX, mouseStartY, card, cardFlipped, cards, set, elemIndexes, boundary, evt) {
    // the held card should be pinned to the mouse
    const pinX = squish(evt.screenX - mouseStartX, boundary.left, boundary.width);
    const pinY = squish(evt.screenY - mouseStartY, boundary.top, boundary.height);

    // move the card
    let translate = `translate3d(${pinX}px, ${pinY}px, 0)`;
    if (cardFlipped) {
        translate += ` rotateY(180deg)`;
    }
    card.style.transform = translate;

    // swap the card with its closest neighbor
    // find neighbor
    const lastPos = readInt(card, 'data-last', 'data-index');
    const nextPos = getClosestSlot(card.offsetLeft + pinX, card.offsetTop + pinY);
    // don't swap with self or when the positions are invalid
    if (lastPos === nextPos || 0 > nextPos || nextPos >= cards.length) {
        return;
    }
    const neighbor = cards[elemIndexes[nextPos]];
    // record the new indexes of cards, so we can still find the DOM element
    elemIndexes[nextPos] = readInt(card, 'data-index');
    elemIndexes[lastPos] = readInt(neighbor, 'data-index');
    // swap data-last
    card.setAttribute('data-last', nextPos.toString());
    neighbor.setAttribute('data-last', lastPos.toString());
    // move the neighboring card to this card's previous space
    const oldSpace = getSlotRect(lastPos);
    // offsetLeft and offsetRight do not account for transform -- they give the original location of the element
    // translate3d is relative to the original location of the card while
    translate = `translate3d(${oldSpace.x - neighbor.offsetLeft}px, ${oldSpace.y - neighbor.offsetTop}px, 0)`;
    if (neighbor.classList.contains('flipped')) {
        translate += ` rotateY(180deg)`;
    }
    neighbor.style.transform = translate;
}


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
    }

    evt.currentTarget.removeEventListener('mousemove', tracker);
}


// create new flashcard form functionality
document.querySelectorAll('.create form').forEach(form => {
    form.addEventListener('submit', evt => {
        evt.preventDefault();
        const frontInputElem = form.querySelector('.front-input');
        const frontInput = frontInputElem.value.trim();
        const backInput = form.querySelector('.back-input').value.trim();

        if (frontInput && backInput) {
            const set = form.parentElement.parentElement.parentElement;
            const modifyButton = set.querySelector('.modify');
            const newCard = createCard(frontInput, backInput);
            newCard.addEventListener('click', clickCard);
            newCard.addEventListener('mousedown', startDrag);
            newCard.setAttribute('data-index', set.querySelectorAll('.card:not(.button)').length.toString());

            const modifying = modifyButton.classList.contains('flipped');
            if (modifying) {
                newCard.classList.add('modifying');
            }

            // insert the new card
            set.insertBefore(newCard, modifyButton);
            const grow = [{transform: `scale(0)`},
                          {transform: 'scale(1)'}];
            newCard.animate(grow, ANIMATION_TIMING);

            const gap = form.parentElement.offsetWidth + 14;
            function getRectFromSlotIndex(index) {
                // returns a DOMRect representing the location and size of a slot, given the slot's index
                return new DOMRect((gap) * (index % COLUMNS),
                    (gap) * Math.floor(index / COLUMNS),
                    gap, gap);
            }

            // FLIP
            const numberOfCards = set.querySelectorAll('.card:not(.button)').length;
            const buttons = set.querySelectorAll('.card.button');
            buttons.forEach((button, index) => {
                const dest = getRectFromSlotIndex(index + numberOfCards - 1);
                const src = getRectFromSlotIndex(index + numberOfCards);
                const flipped = button.classList.contains('flipped') ? ' rotateY(180deg)' : '';
                const translation = [
                    { transform: `translate3d(${dest.x - src.x}px, ${dest.y - src.y}px, 0)` + flipped},
                    { transform: 'translate3d(0, 0, 0)' + flipped}
                ];
                button.animate(translation, ANIMATION_TIMING);
            });
            // transition the buttons to their normal locations

            frontInputElem.focus();
            // form.reset();
        }
    });
});
// add click listeners for existing cards
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', clickCard);
})

// when the modify button is pressed, add the class 'modifying' to all the other cards in the set
document.querySelectorAll('.modify').forEach( button => {
    button.addEventListener('click', () => {
        button.parentElement.querySelectorAll('.card:not(.button)').forEach(card => {
            card.classList.toggle('modifying');
        });
    })
});

// create the initial cards
const data = [['de rien', "it's ok"],
              ['je vous en prie', "don't mention it"],
              ["je t'en prie", "you're welcome"]];

grid.prepend(createCardList(...data));

let timer = null;
window.addEventListener('resize', function() {
    const delay = 500 // when the window resizes multiple times in 500 ms, nothing happens

    // reset timer
    clearTimeout(timer);
    timer = setTimeout(function() {
        COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
    }, delay);
})