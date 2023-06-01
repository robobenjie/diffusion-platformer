
/******************************
 * Generate Character Code    *
 * ****************************/

let socket = io();
let setPlayerSprite = null;
export function setChangeSpriteCallback(callback) {
    setPlayerSprite = callback;
}

let currentGeneratingPlayer;
let identifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

let character_options = null;
export function randomizePlayerSprite() {
    fetch('/random_character', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        num_requested: 6
    }),
    })
    .then(response => response.json())
    .then(data => {
        setPlayerSprite(1, data[0].left, data[0].right);
        setPlayerSprite(2, data[1].left, data[1].right);
        character_options = data.slice(-4);
        setSpriteOptions(character_options);
    });
}

function randomizeChoices() {
    fetch('/random_character', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            num_requested: 4
        }),
        })
        .then(response => response.json())
        .then(data => {

            character_options = data;
            setSpriteOptions(character_options);
        });
}
document.getElementById('refreshCharacters').addEventListener('click', function() {
    randomizeChoices();
});

function setSpriteOptions(options) {
    let characterImages = document.getElementsByClassName('character-image');
    for (let i = 0; i < characterImages.length; i++) {
        characterImages[i].src = options[i].right;
        characterImages[i].addEventListener('click', function() {
            setPlayerSprite(currentGeneratingPlayer, options[i].left, options[i].right);
            document.getElementById('generateCharacterModal').classList.remove('is-active');
            document.getElementById('gameCanvas').focus();
        });
    }
}

let types = ["boy", "girl", "woman", "knight", "elf", "wizard", "pirate", "man", "monster"];
let colors = ["red", "blue", "green", "yellow", "black", "white", "purple", "pink", "orange", "silver"];
let things = ["hair", "shirt", "hat", "shoes", "backpack", "bandana", "pointy hat", "jacket", "pants", "scarf"];
document.querySelectorAll('.generateCharacterButton').forEach(button => {
    button.addEventListener('click', function() {
      currentGeneratingPlayer = this.dataset.player;
      document.getElementById('characterDescription').value = getRandomPhrase(); // set the initial value
      document.getElementById('generateCharacterModal').classList.add('is-active');
    });
  });
  

function getRandomPhrase() {
    let randomType = types[Math.floor(Math.random() * types.length)];
    let randomColor = colors[Math.floor(Math.random() * colors.length)];
    let randomThing = things[Math.floor(Math.random() * things.length)];
    return "a " + randomType + " with " + randomColor + " " + randomThing;
}


document.querySelectorAll('.generateCharacterButton').forEach(button => {
  button.addEventListener('click', function() {
    currentGeneratingPlayer = this.dataset.player; // Save which player's button was clicked
    document.getElementById('generateCharacterModal').classList.add('is-active');
  });
});

document.getElementById('closeModal').addEventListener('click', function() {
  document.getElementById('generateCharacterModal').classList.remove('is-active');
});

document.getElementById('cancelCharacter').addEventListener('click', function() {
  document.getElementById('generateCharacterModal').classList.remove('is-active');
});

// Listen for the 'progress' event
socket.on('progress', function(data) {
    if (data.identifier === identifier) {
        let place_in_line = data.place_in_line;
        let statusLabel = document.getElementById('CharacterProgressStatus');
        if (place_in_line > 0) {
            statusLabel.textContent = `${place_in_line - 1} request(s) ahead of you.`;
        } else {
            // Update your progress bar
            let progress = data.progress;
            statusLabel.textContent = `Drawing. ${parseInt(progress * 100)}% complete.`;
            document.getElementById('CharacterProgressBar').value = progress * 100;
        }
    }
});

document.getElementById('submitCharacter').addEventListener('click', function(event) {
    // Prevent the form from being submitted
    event.preventDefault();
    document.getElementById('CharacterProgressStatus').textContent = 'Submitted.';
    document.getElementById('CharacterProgressBar').value = 3;
    fetch('/generate_character', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: document.getElementById('characterDescription').value,
            identifier: identifier // Send the identifier
        }),
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('CharacterProgressBar').value = 100;
        setSpriteOptions(data);
        document.getElementById('CharacterProgressStatus').textContent = '';
    })
    .catch((error) => {
    console.error('Error:', error);
    });
});
