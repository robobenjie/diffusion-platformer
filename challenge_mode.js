import { getGems, clearGems, spawnGem} from './level_edit.js';

let recordingPlayer = null;
// Your recording frequency
const frequency = 20; // 10 Hz
const interval = 1000 / frequency; // Interval in milliseconds
const recordingLength = 10; // 30 seconds

let recordingData = [];

document.getElementById("cancelChallengeButton").addEventListener("click", function() {
    document.getElementById("challengeModalStart").classList.remove('is-active');
});
document.getElementById("openChallengeModal").addEventListener("click", function() {
    document.getElementById("challengeModalStart").classList.add('is-active');
});

document.getElementById("closeChallengeModal").addEventListener("click", function() {
    document.getElementById("challengeModalStart").classList.remove('is-active');
});

let copyChallengeButton = document.getElementById('copyChallengeButton');
let copiedChallengeMessage = document.getElementById('copiedChallengeMessage');

copyChallengeButton.addEventListener('click', function() {
    let textarea = document.createElement('textarea');
    textarea.value = shareChallengeLink.innerText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    copiedChallengeMessage.innerText = 'Copied!';
    setTimeout(function() {
        copiedChallengeMessage.innerText = '';
    }, 2000);
});

let backgroundImage;
export function setBackgroundImage(img) {
    backgroundImage = img;
}


let shareChallengeModal = document.getElementById('shareChallengeModal');
let closeShareChallengeModal = document.getElementById('closeShareChallengeModal');
let closeShareChallengeModalFooter = document.getElementById('closeShareChallengeModalFooter');
let shareChallengeLink = document.getElementById('shareChallengeLink');

function openShareChallengeModal(challenge_id) {
    let imgURL = new URL(backgroundImage.src);
    let imgPath = imgURL.pathname;
    if (imgPath.charAt(0) === "/") {
        imgPath = imgPath.substring(1);
    }
    let url = new URL(window.location.href);
    url.searchParams.set('map_name', imgPath);
    url.searchParams.set('challenge_id', challenge_id);
    shareChallengeLink.innerText = url.toString();
    shareChallengeModal.classList.add('is-active');
};

closeShareChallengeModal.addEventListener('click', function() {
    shareChallengeModal.classList.remove('is-active');
});

closeShareChallengeModalFooter.addEventListener('click', function() {
    shareChallengeModal.classList.remove('is-active');
});



export function setRecording(recording) {
    recordingData = recording;
}

 export function setRecordingPlayer(player) {
    recordingPlayer = player;
 }
 // On button click
 export function startRecording() {
    // Array to store player states
    const playerStates = [];
    clearGems();
    document.getElementById('gameCanvas').focus();
    
    let previousGems = getGems(); // Get initial state of gems

    // Start recording
    const recording = setInterval(function () {
        const currentGems = getGems();

        // Check if a new gem appeared
        const newGems = currentGems.filter(
            gem => !previousGems.some(prevGem => prevGem.x === gem.x && prevGem.y === gem.y)
        );
        
        playerStates.push({
            x: recordingPlayer.x,
            y: recordingPlayer.y,
            vx: recordingPlayer.vx,
            vy: recordingPlayer.vy,
            isJumping: recordingPlayer.isJumping,
            moveUp: recordingPlayer.moveUp,
            moveLeft: recordingPlayer.moveLeft,
            moveRight: recordingPlayer.moveRight,
            newGems: newGems
        });


        // Update the previous gems state
        previousGems = currentGems;
    }, interval);

    // Stop recording after 30 seconds
    setTimeout(function () {
        clearInterval(recording);
        console.log(playerStates);
        recordingData = playerStates;
        fetch("/save_challenge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(playerStates),
        })
        .then(response => response.json())
        .then(data => {
            openShareChallengeModal(data.challenge_id);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }, recordingLength * 1000); // 30000 milliseconds = 30 seconds
}

export function simulatePlayerActions(recordedActions, player) {
    if (!recordedActions) {
        recordedActions = recordingData;
    }
    let actionIndex = 0;
    const interval = 1000 / frequency;
    clearGems();

    // Start simulation
    const simulation = setInterval(function () {
        // Check if there are still actions to simulate
        if (actionIndex < recordedActions.length) {
            // Get the next action
            const action = recordedActions[actionIndex];

            // Set player properties
            player.x = action.x;
            player.y = action.y;
            player.vx = action.vx;
            player.vy = action.vy;
            player.isJumping = action.isJumping;
            player.moveUp = action.moveUp;
            player.moveLeft = action.moveLeft;
            player.moveRight = action.moveRight;

            // Move to the next action
            actionIndex++;
            for (let i = 0; i < action.newGems.length; i++) {
                spawnGem(action.newGems[i].x, action.newGems[i].y);
            }
        } else {
            // If there are no more actions to simulate, stop the simulation
            clearInterval(simulation);
            player.moveUp = false;
            player.moveLeft = false;
            player.moveRight = false;
            console.log('Simulation ended');
            let challengeEndModal = document.getElementById('challengeEndModal');
            challengeEndModal.classList.add('is-active');
        }
    }, interval);
}
