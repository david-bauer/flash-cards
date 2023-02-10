let COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
const ANIMATION_TIMING =  parseInt(getComputedStyle(document.body).getPropertyValue('--animation-speed').slice(0, -2));
const COOKIE = 'cards'


/* helper functions */

function readInt(elem, ...attributes) {
    // returns the first non-null attribute value as an integer.
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
function debounce(callback, delay) {
    /* returns a function that will only trigger once if it is called multiple times within delay seconds
    * used to increase performance on trigger-happy events */
    let timer = null;

    return (event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            callback(event);
        }, delay);
    }
}
function fallback(data, fallbackData) {
    // fills missing properties of data with properties of fallBackData
    Object.keys(fallbackData).forEach(key => {
        if (!(key in data)) {
            data[key] = fallbackData[key];
        }
    });
    return data;
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
function getProps(set) {
    const props = [{}, {}];
    Object.entries(set.dataset).forEach(([key, value]) => {
        if (key.includes('Front')) {
            props[0][key.slice(0, -5)] = value;
        } else if (key.includes('Back')) {
            props[1][key.slice(0, -4)] = value;
        }
    });
    return props;
}
function getCards(set) {
    // returns an HTMLCollection of all the cards in a card set
    return set.querySelectorAll('.card:not(.card-settings)')
}
function readCards(setElem) {
    // returns a list of the card face pairs in setElem
    let cards = [];
    getCards(setElem).forEach(cardElem => {
        const faceElems = cardElem.querySelectorAll('.card-face');
        cards.push([faceElems[0].innerText.trim(), faceElems[1].innerText.trim()]);
    });
    return cards;
}
function exportCards(setElem, faceSeparator, cardSeparator) {
    // returns a string representation of the cards in setElem
    return readCards(setElem).reduce((total, cardText, index, set) => {
        if (index < set.length - 1) {
            return total + cardText[0] + faceSeparator + cardText[1] + cardSeparator;
        } else { // don't print a cardSeparator after the last card
            return total + cardText[0] + faceSeparator + cardText[1];
        }
    }, '');
}
function importCards(cardString, faceSeparator, cardSeparator) {
    // returns a list of card face pairs from a string
    const cards = cardString.split(cardSeparator);
    return cards.map((card, index) => {
        const faces = card.split(faceSeparator);
        if (faces.length !== 2){
            throw SyntaxError(`Card import failed due to incorrectly formatted data: each card must have exactly two faces. \n Card ${index} has ${faces.length}: '${faces.join(',')}'`);
        }
        return faces;
    });
}
function readSet(set) {
    return {
        title: set.dataset.title,
        props: getProps(set),
        cards: readCards(set)
    };
}
function saveAll() {
    const setList = [];
    document.querySelectorAll('.flash-card-set').forEach(set => {
        setList.push(readSet(set));
    })
    localStorage.setItem(COOKIE, JSON.stringify(setList));
}

function copyButton(button) {
    // copies the text of the previous element to the clipboard and animates the button
    navigator.clipboard.writeText(button.previousElementSibling.innerText.trim()).then(() => {
        // change the label of the button to indicate that something has happened
        const oldLabel = button.getAttribute('aria-label');
        button.setAttribute('aria-label', 'copied!');
        button.setAttribute('aria-pressed', 'true');
        // reset the button label a second later
        setTimeout(() => {
            button.setAttribute('aria-label', oldLabel);
            button.setAttribute('aria-pressed', 'false');
        }, 2000);
    });
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
    // remove the card from the normal flow (so that the rest of the cards can move left)
    card.style.left = toPx(card.offsetLeft);
    card.style.top = toPx(card.offsetTop);
    card.style.width = toPx(card.offsetWidth);
    card.style.height = toPx(card.offsetHeight);
    card.style.position = 'absolute';
    // shrink it
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
function setTitle(set, newTitle) {
    set.dataset.title = newTitle;
    set.querySelector('.set-title').innerText = newTitle;
}
function setProps(set, props) {
    function helper(propsSide, side) {
        const cards = set.querySelectorAll(`.${side.toLowerCase()} > p`);
        Object.entries(propsSide).forEach(([key, value]) => {
            set.dataset[key + side] = value;

            if (cards) {
                cards.forEach(card => {
                    card.setAttribute(key, value);
                });
            }
        });
    }
    helper(props[0], 'Front');
    helper(props[1], 'Back');
}

function renderFace(side, content, props) {
    const face = document.createElement('div');
    face.classList.add('card-face');
    face.classList.add(side);

    const text = document.createElement('p');
    text.innerText = content;

    Object.entries(props).forEach(([propertyName, propertyValue]) => {
        if (propertyName === 'class' || propertyName === 'value' || propertyName === 'script') {
            console.error(`Invalid card property: setting ${propertyName} this way can cause unintended consequences`);
        }
        text.setAttribute(propertyName, propertyValue.toString());
    });
    face.append(text);

    return face;
}
function renderCard(front, back, props, index) {
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
                        <button class="button edit-btn" disabled aria-pressed="false" aria-label="edit this card"><i class="las la-pen-alt la-lg"></i></button>\
                        <button class="button delete-btn" disabled aria-pressed="false" aria-label="delete this card"><i class="las la-trash-alt la-lg"></i></button>\
                     </div>'

    card.prepend(button);
    card.append(renderFace('front', front, props[0]),
                renderFace('back', back, props[1]));

    if (index !== undefined) {
        card.setAttribute('data-index', index);
    }

    return card;
}
function renderCardList(cards, props) {
    // returns a DocumentFragment containing cards created from the parameters
    const list = new DocumentFragment();
    cards.forEach(([front, back], index) => {
        const newCard = renderCard(front, back, props, index);
        list.appendChild(newCard);
        newCard.addEventListener('click', flipCardEvent);
    });
    return list;
}
function renderCardSet(data) {
    fallback(data, {
        title: 'title missing',
        props: [{lang: 'missing'}, {lang: 'missing'}],
        cards: [["cards missing", ":("]]
    });

    const set = document.createElement('div');
    set.classList.add('flash-card-set');
    set.dataset.title = data.title;
    setProps(set, data.props);
    /* add set header (title + popup) */
    set.innerHTML = `
        <div class="space-between">
            <h2 class="set-title">${data.title}</h2>
            <button class="button square set-config-trigger relative" aria-label="settings" onclick="openSettingsPopup(this.parentElement.parentElement);"><i class="las la-cog la-lg"></i></button>
        </div>
        <div class="popup hidden">
            <div class="space-between">
                <h2>Settings</h2>
                <button class="button square popup-close-btn"><i class="las la-times"></i></button>
            </div>
            <form class="set-config-form">
                <label>Title<input type="text" name="title" value=""/></label>
                <div class="cols-2">
                    card content languages
                    <div class="cols-2">
                        <label>frontside<input type="text" name="langFront" value=""/></label>
                        <label>backside<input type="text" name="langBack" value=""/></label>
                    </div>
                </div>
            </form>
            <form class="export-import-form">
                <div class="space-between">
                    <h3>export / import</h3>
                    <div class="cols-2">
                        delimiters
                        <div class="cols-2" style="width: 6em; position:relative; top: -6px">
                            <label class="center-text">card<input type="text" name="card" value="" required/></label>
                            <label class="center-text">face<input type="text" name="face" value="" required/></label>
                        </div>
                    </div>
                </div>
                <div class="textarea relative">
                    <code class="source-input" contenteditable=""></code>
                    <button type="button" class="button copy-btn" onclick="copyButton(this);" aria-label="copy to clipboard"> copy </button>
                </div>
            </form>
            <button type="button" class="button delete-btn" style="width: fit-content;" onclick="removeCardSet(this.parentElement.parentElement)">delete this set</button>
        </div>`;
    /* TODO future popup features:
     * duplicate button
     * randomize order button
     * confirm user meant to click the delete button
     */

    const cards = document.createElement('div');
    cards.classList.add('flash-cards');

    const cardFormWrapper = document.createElement('div');
    cardFormWrapper.classList.add('card', 'card-settings', 'create', 'hidden');
    cardFormWrapper.setAttribute('aria-disabled', 'true');

    const cardForm = document.createElement('form');
    cardForm.classList.add('new-card-form');
    cardForm.innerHTML = `
            <input type="text" placeholder="front side" name="front" required/>
            <input type="text" placeholder="back side" name="back" required/>
            <button class="button" type="submit">add card</button>`
    cardForm.addEventListener('submit', createCardEvent);
    cardFormWrapper.append(cardForm);

    const modifyButton = document.createElement('div');
    modifyButton.classList.add('card', 'card-settings', 'modify');
    modifyButton.innerHTML = `
            <button class="card-flipper" aria-label="modify these flashcards"></button>
            <div class="card-face front"><i class="las la-tools la-3x"></i></div>
            <div class="card-face back"><i class="las la-times la-3x"></i></div>`;
    modifyButton.addEventListener('click', modifyCardsEvent);

    cards.append(renderCardList(data.cards, data.props), cardFormWrapper, modifyButton);
    set.append(cards);

    return set;
}
function removeCardSet(set) {
    const keyframes = [
        {transform: 'scale(1)'},
        {transform: 'scale(0)'}
    ];
    set.animate(keyframes, ANIMATION_TIMING).finished.then(() => {
        set.remove();
        saveAll();
    });
}

/* popup functionality */
function openSettingsPopup(set) {
    // extract key properties from the DOM (title, language, etc.)
    const popup = set.querySelector('.popup');
    const trigger = set.querySelector('.set-config-trigger');
    const defaultDelimiters = {face:', ', card: '\\n'};
    const source = exportCards(set, defaultDelimiters.face, defaultDelimiters.card.replace('\\n', '\n'));

    // update the forms with the extracted properties
    const configForm = popup.querySelector('.set-config-form');
    configForm.elements.title.value = set.dataset.title;
    configForm.elements.langFront.value = set.dataset.langFront;
    configForm.elements.langBack.value = set.dataset.langBack;
    const configUpdateEvent = debounce(settingsUpdateEvent, 200);
    configForm.addEventListener('input', configUpdateEvent);

    const exportForm = popup.querySelector('.export-import-form');
    exportForm.elements.face.value = defaultDelimiters.face;
    exportForm.elements.card.value = defaultDelimiters.card;
    set.querySelector('.source-input').innerText = source;
    const exportUpdateEvent = exportUpdateEventHandlerFactory(exportForm);
    exportForm.addEventListener('input', exportUpdateEvent);

    // make the popup-close-btn remove event listeners and hide the popup
    const closeButton = popup.querySelector('.popup-close-btn');
    const closeSettingsPopupEvent = (clickEvent) => {
        configForm.removeEventListener('input', configUpdateEvent);
        exportForm.removeEventListener('input', exportUpdateEvent);
        const fadeOut = [{opacity: 1},
            {opacity: 0}];
        popup.animate(fadeOut, ANIMATION_TIMING).finished.then(() => {
            popup.classList.add('hidden');
        });
        trigger.removeAttribute('disabled');
        saveAll();
    }
    closeButton.addEventListener('click', closeSettingsPopupEvent, {once: true});
    // TODO: make clicking anywhere but the popup close the popup

    // display the popup
    trigger.setAttribute('disabled', 'true');
    popup.style.top = `calc(${trigger.offsetTop}px - 1rem)`;
    popup.style.right = '-1rem';
    popup.classList.remove('hidden');
    const fadeIn = [{opacity: 0},
                    {opacity: 1}];
    popup.animate(fadeIn, ANIMATION_TIMING);
}

function settingsUpdateEvent(InputEvent) {
    const inputs = InputEvent.target.form.elements;
    const set = InputEvent.target.form.parentElement.parentElement;
    const newTitle = inputs.title.value.trim();
    const newProps = [
        {lang: inputs.langFront.value.trim()},
        {lang: inputs.langBack.value.trim()}
    ];

    if (newTitle !== set.dataset.title) {
        setTitle(set, newTitle);
    }

    // hack to deep compare objects
    if (JSON.stringify(newProps) !== JSON.stringify(getProps(set))) {
        setProps(set, newProps);
    }
}

function exportUpdateEventHandlerFactory(ExportImportForm) {
    const set = ExportImportForm.parentElement.parentElement;
    const delimInputs = ExportImportForm.elements;
    const sourceInput = set.querySelector('.source-input');
    let oldProps = {
        card: ExportImportForm.elements.card.value.replace('\\n', '\n'),
        face: ExportImportForm.elements.face.value.replace('\\n', '\n'),
        source: undefined,
    };
    let timer = null;

    return (InputEvent) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const newProps = {
                card: delimInputs.card.value.replace('\\n', '\n'),
                face: delimInputs.face.value.replace('\\n', '\n'),
                source: sourceInput.innerText.replace('\<br>', '\n')
            };
            console.table(oldProps);
            console.table(newProps);
            if (oldProps.card !== newProps.card || oldProps.face !== newProps.face) {
                // delimiter values changed, rerender source
                const source = set.querySelector('.source-input');
                source.innerText = exportCards(set, newProps.face, newProps.card);
                source.classList.remove('.error');
                // update oldProps
                oldProps = newProps;
            } else if (oldProps.source !== newProps.source) {
                // source changed, import it
                try {
                    const newCards = importCards(newProps.source, newProps.face, newProps.card);
                    getCards(set).forEach(card => {
                        card.remove();
                    });
                    set.querySelector('.flash-cards').prepend(renderCardList(newCards, getProps(set)));
                    /* the cards' state gets messed up when the source is edited while modification mode is on
                    TODO: generate the cards so that they are aligned with the modification mode
                     */
                    sourceInput.classList.remove('error');
                } catch (SyntaxError) {
                    // import failed because of bad syntax
                    console.error(SyntaxError);
                    sourceInput.classList.add('error');
                }
                // update oldProps
                oldProps = newProps;
            }
        }, 500);
    }
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
    const cards = getCards(set);
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
                return readInt(a, 'data-last', 'data-index') - readInt(b, 'data-last', 'data-index');
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
    const front = form.elements.front.value.trim();
    const back = form.elements.back.value.trim();
    const set = form.parentElement.parentElement;

    // only add a new card when the form is valid and the set is in modify mode
    if (front && back && set.querySelector('.modify.flipped')) {
        const nextCardIndex = getCards(set).length
        const newCard = renderCard(front, back, getProps(set), nextCardIndex);
        // update the new Card's values so that it behaves under modify mode (renderCard assumes modify mode is off)
        newCard.classList.add('modifying');
        newCard.firstElementChild.toggleAttribute('disabled');  // disable the card flip button
        newCard.addEventListener('mousedown', startDragEvent);
        // make the edit and delete buttons clickable
        const tools = newCard.querySelector('.modify-tools');
        for (const tool of tools.children) {
            tool.removeAttribute('disabled');
        }
        tools.addEventListener('click', editCardEvent);

        // insert the new card and animate it growing
        set.insertBefore(newCard, form.parentElement);
        growCard(newCard);

        // the cards after the new one get pushed to the right--animate it with FLIP
        const buttons = set.querySelectorAll('.card-settings');
        buttons.forEach((button, index) => {
            const dest = getSlotRect(index + nextCardIndex);
            const src = getSlotRect(index + nextCardIndex + 1);
            slideCard(button, dest.x - src.x, dest.y - src.y);
        });

        form.elements.front.focus();
        form.reset();
    }
}

function createSetEvent(clickEvent) {
    const emptyCardSet = {
        title: 'new set',
        props: [{lang: 'en'}, {lang: 'en'}],
        cards: [['hello!', 'i love u!']]
    }
    const newSet = renderCardSet(emptyCardSet);
    newSet.classList.add('hidden');
    contentWrapper.append(newSet);
    growCard(newSet);
}

// Handles click events for the modification buttons (edit, delete) on each card
function editCardEvent(clickEvent) {
    const card = clickEvent.currentTarget.parentElement;
    // delete button pressed
    if (clickEvent.target.classList.contains('delete-btn')) {
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

    } else if (clickEvent.target.classList.contains('edit-btn')) {
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
    for (const tool of tools.children) {
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
        saveAll();
    } else {
        // show the form
        growCard(newCardForm);
        const newPos = getSlotRect(numCards - 1);
        const oldPos = getSlotRect(numCards - 2);
        slideCard(button, oldPos.x - newPos.x, oldPos.y - newPos.y);
    }

    // toggle the modification state of all the cards in the set
    getCards(set).forEach(toggleModifyCard);
}


// Example sets
const sample = [{
        title: "I'm a set of flash cards!",
        props: [{lang: 'en'}, {lang: 'en'}],
        cards: [
            ["i'm a flash card!", "you are not a flash card!"],
            ["click me!!", "do it again!!"],
            ["i wanna change the set title!", "click the gear in the top right!!"],
            ["edit me by clicking over here -->", "drag me so i don't make sense!!"]]
    }];

const french = [
    {
        title: 'translate the french terms to english',
        props: [{lang: 'fr'}, {lang: 'en'}],
        cards: [
            ["de rien", "it's ok"],
            ["je vous en prie", "don't mention it"],
            ["je t'en prie", "you're welcome"],
            ["excusez-moi", "excuse me"],
            ["il n'y a pas de quoi", "there's nothing to get worked up about"],
            ["ca s'ecrit comment?", "how is that written?"],
            ["faire", "to do"]]
    }];

// Load the previous state from memory
const data = JSON.parse(localStorage.getItem(COOKIE)) ?? sample;
const contentWrapper = document.querySelector('.content')
data.forEach(set => {
    contentWrapper.append(renderCardSet(set));
});

// Update global constants COLUMNS and GAP when the window resizes
let GAP = document.querySelector('.card').offsetWidth + 16;
window.addEventListener('resize', debounce(
    (resizeEvent) => {
        COLUMNS = parseInt(getComputedStyle(document.body).getPropertyValue('--columns'));
        GAP = document.querySelector('.card:last-child').offsetWidth + 16;
    }, 500));

// useful for fast debugging
const set = document.querySelector('.flash-card-set');