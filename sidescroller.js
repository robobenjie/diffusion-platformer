import { isEditMode, tileSize, gameMap, mapHeight, mapWidth, setMap, loadStyles,
     drawMap, setMapChangeCallback, setIsEditMode, getCurrentStyle, styles, setStyle, getMapEditorImage,
     saveAllStyleImages} from './level_edit.js';
import { setChangeSpriteCallback, randomizePlayerSprite } from './character_select.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let dieSound = new Audio('/sounds/pop.wav');
let gemSound = new Audio('/sounds/coin.mp3');
let changeBackgroundSound = new Audio('/sounds/change_background.mp3');
let currentImageStyle = null;
const collisionBoxWidthFraction = 0.5;

// Constants for gem spawning
const minGemSpawn = 1; // Minimum seconds between gem spawns
const maxGemSpawn = 5; // Maximum seconds between gem spawns
const maxGemCount = 4; // Maximum number of gems on the screen at once
// Initialize lastGemSpawn to the current time

const targetFPS = 165;

let socket = io();

let lastGemSpawn = Date.now();

let backgroundImage = new Image();
let newBackgroundImage = new Image();
let collectibleImage = new Image();
let pointsSinceHop = 0;

//backgroundImage.src = "example_background.png";


// 0 = open space, 1 = wall/floor

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log("Map name", urlParams.get('map_name'));
    let map_promise = fetch('/get_map', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            map_path: urlParams.get('map_name')
        }),
    })
    .then(response => response.json())
    .then(data => {
        setMap(data.map);
        backgroundImage.src = data.image;
        respawnPlayer(player);
        respawnPlayer(player2);
        gameCanvas.focus();
        currentImageStyle = data.style;
        return data;
    })
    .catch((error) => {
      console.error('Error:', error);
    });

    let collectible_promise = fetch('/random_collectible')
    .then(response => response.json())
    .then(data => {
        collectibleImage.src = data.image;
        return data;
    });

    randomizePlayerSprite(1);
    randomizePlayerSprite(2);

    let style_promise = loadStyles();

    /*Promise.all([map_promise, style_promise, collectible_promise]).then(values => {
        // at this point, both the map and styles are loaded
        let mapDataImage = values[0].image; 
        let folder = mapDataImage.split('/').slice(0, 2).join('/');
        saveAllStyleImages(folder);  // call your method that needs both map and styles
    });*/
}



/******************************************************
 **                PLAYER CONTROLS                   **
 ******************************************************/

const playerConfig = {
    size: tileSize / 2 - 2,
    ax: 0.2 * targetFPS,
    maxVx: 2,
    friction: 0.9,
    gravity: 0.25 * targetFPS * targetFPS,
    size: tileSize / 2,
    ticksPerFrame: 15,   // Number of updates between each frame change
    numberOfFrames: 4,   // Total number of frames in the animation
};

const player = {
    ...playerConfig,
    x: tileSize * 2,
    y: tileSize * 2,
    color: 'yellow',
    vx: 0,
    vy: 0,
    isJumping: false,
    score: 0,
    frameIndex: 0,       // Current frame of the animation
    tickCount: 0,        // Counts the number of updates since the last frame change
    direction: 'right', 
    rightSprite: new Image(),
    leftSprite: new Image(),
};

const player2 = {
    ...playerConfig,
    x: tileSize * 6,
    y: tileSize * 2,
    color: 'red',
    vx: 0,
    vy: 0,
    isJumping: false,
    score: 0,
    frameIndex: 0,       // Current frame of the animation
    tickCount: 0,        // Counts the number of updates since the last frame change
    direction: 'right', 
    rightSprite: new Image(),
    leftSprite: new Image(),
};

setMapChangeCallback(function(EditMapBackgroundImage) {
    respawnPlayer(player);
    respawnPlayer(player2);
    if (EditMapBackgroundImage != null) {
        backgroundImage.src = EditMapBackgroundImage;
    }
});


function drawPlayer(player) {
    // Define the width and height of each frame
    let playerSprite;
    if (player.moveRight) {
        player.direction = 'right';
    } else if (player.moveLeft) {
        player.direction = 'left';
    }
    
    if (player.direction === 'right') {
        playerSprite = player.rightSprite;
    } else {
        playerSprite = player.leftSprite;
    }
    let frameWidth = playerSprite.width / player.numberOfFrames;
    let frameHeight = playerSprite.height;

    player.tickCount += 1;
    
    if (player.tickCount > player.ticksPerFrame) {
        player.tickCount = 0;
        
        // If the player is jumping or standing, set the frame index directly
        if (player.isJumping) {
            player.frameIndex = player.direction == 'right' ? 1 : 0;
        } else if (Math.abs(player.vx) < 0.01 || !(player.moveRight || player.moveLeft)) {
            player.frameIndex = player.direction == 'right' ? 0 : 1;
        } else {
            // If the player is walking, advance the animation frame
            player.frameIndex = (player.frameIndex + 1) % player.numberOfFrames;
        }
    }

    // Determine the current frame to draw
    let frameX = player.frameIndex * frameWidth;

    // Save the current context
  
    let playerscale = 0.8;
    const heightOffset = -(frameHeight - frameHeight*playerscale) + 27;
    ctx.drawImage(playerSprite, frameX, 0, frameWidth, frameHeight, player.x - frameWidth / 2, player.y - frameHeight / 2 - heightOffset, frameWidth * playerscale, frameHeight * playerscale);
}

// Create an array to hold the particles
let particles = [];
let particleSize = 5;
const playerExplosionCount = 20;
const particleGravity = 0.06 * targetFPS * targetFPS;
const particleExplotionSpeed = 2.5 * targetFPS;

// When the player is killed
function playerKilled(player) {
    // Break the player sprite into particles
    dieSound.cloneNode().play().catch(error => {
        console.log("Error playing audio: ", error);
    });
    for (let i = 0; i < playerExplosionCount; i += 1) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() * 2 - 1) * particleExplotionSpeed / 2,
            vy: (Math.random() * 2 - 1) * particleExplotionSpeed,
            size: particleSize,
            lifespan: 100
        });
    }
}

// Update the particles each frame
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        let newx = p.x + p.vx * dt;
        let newy = p.y + p.vy * dt;
        if (isColliding(p.x, newy)) {
            p.vy *= -0.5;
            p.xy *= 0.2;
        }
        if (isColliding(newx, p.y)) {
            p.vx *= -0.5;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += particleGravity * dt;
        p.size *= 0.99;
        p.lifespan--;
        if (p.lifespan <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Draw the particles each frame
function drawParticles(ctx) {
    ctx.fillStyle = "darkred";  // Set the color to dark red
    for (let p of particles) {
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
}

function render_gems(ctx) {
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {

            let currentTimeInSeconds = Date.now() / 1000;
            let sinusoid = Math.sin(currentTimeInSeconds * 2.0 + i + j) * 4;

            if(gameMap[i][j] === 2) {
                // render collectible_image
                ctx.drawImage(collectibleImage, j * tileSize, i * tileSize + sinusoid, collectibleImage.height *0.7, collectibleImage.width * 0.7);
            }
        }
    }
}
let animationProgress = null;
const animationLength = 0.5; // seconds
function renderBackgroundImage(ctx, dt) {
    if (animationProgress !== null) {
        // An animation is in progress
        animationProgress += dt;

        // Draw the old image in full
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // Calculate the current width based on animation progress
        const currentWidth = animationProgress / animationLength * canvas.width;

        // Draw the new image only up to the current width
        // The parameters here are (image, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight)
        ctx.drawImage(newBackgroundImage, 0, 0, currentWidth, newBackgroundImage.height, 0, 0, currentWidth * (canvas.width / newBackgroundImage.width), canvas.height);


        // Check if animation is finished
        if (animationProgress >= animationLength) {
            // Animation complete, set newImage as backgroundImage
            backgroundImage = newBackgroundImage;
            animationProgress = null;
        }
    } else {
        // No animation, render the image as usual
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}

function drawJaggedLine(ctx, x1, y1, x2, y2, numSections, maxDeviation) {
    // Calculate the length of the line and the segment length
    let lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    let segmentLength = lineLength / numSections;

    // Start the line
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i < numSections; i++) {
        // Calculate the direction of the line
        let angle = Math.atan2(y2 - y1, x2 - x1);

        // Calculate the direction of the perpendicular
        let perpAngle = angle - Math.PI / 2;

        // Calculate the segment end
        let segmentEndX = x1 + Math.cos(angle) * segmentLength * i;
        let segmentEndY = y1 + Math.sin(angle) * segmentLength * i;

        // Calculate the deviation
        let deviation = Math.abs((Math.random() -1) * maxDeviation);

        // Calculate the point to draw to
        let x = segmentEndX + Math.cos(perpAngle) * deviation;
        let y = segmentEndY + Math.sin(perpAngle) * deviation;

        // Draw to the calculated point
        ctx.lineTo(x, y);
    }

   // stroke the line as thick and white
    ctx.lineWidth = 3;
    ctx.strokeStyle = "cyan";
    ctx.stroke();
}

function renderForegroundImageParts(ctx, foregroundImage) {
    // Calculate the current width based on animation progress
    const currentX = animationProgress / animationLength * canvas.width;

    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (gameMap[i][j] === 1) {               
                // The dx, dy, dWidth, dHeight parameters specify where on the canvas to draw that portion of the image
                let topBuffer = tileSize * 0.15;
                let dx = j * tileSize;
                let dy = i * tileSize - topBuffer;
                let dWidth = tileSize;
                let dHeight = tileSize + topBuffer;
                
                // Draw the portion of the image that corresponds to the wall section on the canvas
                if (dx < currentX) {
                    ctx.drawImage(newBackgroundImage, dx, dy, dWidth, dHeight, dx, dy, dWidth, dHeight);
                } else {
                  ctx.drawImage(foregroundImage, dx, dy, dWidth, dHeight, dx, dy, dWidth, dHeight);
                }
            }
        }
    }
    if (animationProgress !== null) {
        drawJaggedLine(ctx, currentX, 0, currentX, canvas.height, 100, 10);
        drawJaggedLine(ctx, currentX, 0, currentX, canvas.height, 50, 30);
        drawJaggedLine(ctx, currentX, 0, currentX, canvas.height, 20, 50);
    }
}

function getCollidingPlayers(currentPlayer, otherPlayers, x, y, buffer = 0) {
    return otherPlayers.filter(player => {
        const dx = x - player.x;
        const dy = y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= currentPlayer.size + player.size + buffer;
    });
}

function updatePlayer(currentPlayer, otherPlayers, dt) {
    if (!isInGameArea(currentPlayer.x, currentPlayer.y)) {
        respawnPlayer(currentPlayer);
        return
    }
    if (isColliding(currentPlayer.x, currentPlayer.y, 0)) {
        respawnPlayer(currentPlayer);
    }
    const gemX = Math.floor(currentPlayer.x / tileSize);
    const gemY = Math.floor(currentPlayer.y / tileSize);
    if (gameMap[gemY][gemX] === 2) {
        gameMap[gemY][gemX] = 0;
        currentPlayer.score += 1;
        pointsSinceHop += 1;
        if (pointsSinceHop >= 20) {
            pointsSinceHop = 0;
            hopToRandomStyle();

        }
        gemSound.cloneNode().play().catch(error => {
            console.log("Error playing audio: ", error);
        });
    }

    // Horizontal movement
    if (currentPlayer.moveLeft && currentPlayer.vx > -currentPlayer.maxVx) {
        currentPlayer.vx -= currentPlayer.ax * dt;
    } else if (currentPlayer.moveRight && currentPlayer.vx < currentPlayer.maxVx) {
        currentPlayer.vx += currentPlayer.ax * dt;
    } else {
        currentPlayer.vx *= Math.pow(currentPlayer.friction, dt * targetFPS);
    }

    // Check for kills
    getCollidingPlayers(currentPlayer, otherPlayers, currentPlayer.x, currentPlayer.y, 5).forEach((collidingPlayer) => {
        const AbsDeltaX = Math.abs(currentPlayer.x - collidingPlayer.x);
        if (collidingPlayer.y > currentPlayer.y - currentPlayer.vy * dt + tileSize - 1 && AbsDeltaX < currentPlayer.size && currentPlayer.vy > 0) {
            playerKilled(collidingPlayer);
            respawnPlayer(collidingPlayer);
            currentPlayer.score += 3;
            collidingPlayer.score -= 3;
            collidingPlayer.score = Math.max(collidingPlayer.score, 0);
        } else {
            let delta = currentPlayer.x - collidingPlayer.x;

            // Only collide if they are pretty close together
            const coefficientOfRestitution = 0.65
            if (Math.abs(delta) < currentPlayer.size * collisionBoxWidthFraction) {
                let tmp = currentPlayer.vx;
                currentPlayer.vx = collidingPlayer.vx * coefficientOfRestitution + .01 * delta;
                collidingPlayer.vx = tmp * coefficientOfRestitution - .01 * delta;
            }
        }
    });

    // Horizontal collision

    const newX = currentPlayer.x + currentPlayer.vx;
    if (isColliding(newX, currentPlayer.y, currentPlayer.size * collisionBoxWidthFraction)) {
        currentPlayer.vx = 0;
    } else {
        currentPlayer.x = newX;
    }

   // Vertical movement (gravity and jumping)
   if (currentPlayer.moveUp && !currentPlayer.isJumping && isOnGround(currentPlayer)) {
        currentPlayer.vy = -4.5 * targetFPS;
        currentPlayer.isJumping = true;
    }
    if (currentPlayer.moveUp) {
        currentPlayer.vy += (currentPlayer.gravity * 0.3) * dt;
    } else {
        currentPlayer.vy += currentPlayer.gravity * dt;
    }
    currentPlayer.y += currentPlayer.vy * dt;

    // Vertical collision
    if (isColliding(currentPlayer.x, currentPlayer.y + currentPlayer.size / 2, collisionBoxWidthFraction * currentPlayer.size) && currentPlayer.vy >= 0) { // Ground collision
        currentPlayer.y = Math.floor((currentPlayer.y + currentPlayer.size / 2) / tileSize) * tileSize - currentPlayer.size / 2;
        currentPlayer.isJumping = false;
        currentPlayer.vy = 0;
    } else if (isColliding(currentPlayer.x, currentPlayer.y - currentPlayer.size / 2, collisionBoxWidthFraction * currentPlayer.size)) { // Ceiling collision
        currentPlayer.y = Math.ceil((currentPlayer.y - currentPlayer.size / 2) / tileSize) * tileSize + currentPlayer.size / 2;
        currentPlayer.vy = 0.01 * targetFPS; // Math.Min(0, currentPlayer.vy);
    }
}

function respawnPlayer(player) {
    // Create a list of empty spots on the map
    const emptySpots = [];
    for (let y = 0; y < gameMap.length; y++) {
        for (let x = 0; x < gameMap[y].length; x++) {
            if (!isColliding(x * tileSize, y * tileSize, player.size)) {
                emptySpots.push({ x: x * tileSize, y: y * tileSize });
            }
        }
    }

    // Select a random spot from the list
    const randomIndex = Math.floor(Math.random() * emptySpots.length);
    const randomSpot = emptySpots[randomIndex];

    // Set the player's position to the selected spot
    player.x = randomSpot.x;
    player.y = randomSpot.y;

    // Reset the player's velocity
    player.vx = 0;
    player.vy = 0;
}

function isInGameArea(x, y, xBuffer = 0) {
    // Check the point xBuffer to the left and right of x
    const leftX = x - xBuffer;
    const rightX = x + xBuffer;
    
    // Calculate grid positions
    const gridXLeft = Math.floor(leftX / tileSize);
    const gridXRight = Math.floor(rightX / tileSize);
    const gridY = Math.floor(y / tileSize);

    // Check if the player is within the game area
    if (gridXLeft < 0 || gridY < 0 || gridXRight >= gameMap[0].length || gridY >= gameMap.length) {
        return false;
    }
    return true;
}

function isColliding(x, y, xBuffer = 0) {
    // Check the point xBuffer to the left and right of x
    const leftX = x - xBuffer;
    const rightX = x + xBuffer;
    
    // Calculate grid positions
    const gridXLeft = Math.floor(leftX / tileSize);
    const gridXRight = Math.floor(rightX / tileSize);
    const gridY = Math.floor(y / tileSize);

    // Check if the player is within the game area
    if (gridXLeft < 0 || gridY < 0 || gridXRight >= gameMap[0].length || gridY >= gameMap.length) {
        return true;
    }

    // If the cell contains a wall (1), it's a collision
    const cellContentLeft = gameMap[gridY][gridXLeft];
    const cellContentRight = gameMap[gridY][gridXRight];

    return cellContentLeft === 1 || cellContentRight === 1;
}

function isOnGround(player) {
    return isColliding(player.x, player.y + player.size / 2 + 1, player.size * collisionBoxWidthFraction);
}

let gameArea = document.getElementById('gameCanvas');

gameArea.addEventListener('click', function() {
    gameCanvas.focus();
});

gameArea.addEventListener('focus', function() {
    // Enable key event handlers when gameArea gets focus
    window.addEventListener('keydown', keydownHandler, false);
    window.addEventListener('keyup', keyupHandler, false);
});

gameArea.addEventListener('blur', function() {
    // Disable key event handlers when gameArea loses focus
    window.removeEventListener('keydown', keydownHandler, false);
    window.removeEventListener('keyup', keyupHandler, false);
});

function keydownHandler(event) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) {
        event.preventDefault();
        // Your current keydown handler logic here...
    }

    // Letters
    if(["a", "s", "d", "w"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        
    }
    if (event.key === 'ArrowUp') player.moveUp = true;
    if (event.key === 'ArrowDown') player.moveDown = true;
    if (event.key === 'ArrowLeft') player.moveLeft = true;
    if (event.key === 'ArrowRight') player.moveRight = true;

    // Player 2 controls
    if (event.key === 'w') player2.moveUp = true;
    if (event.key === 'a') player2.moveLeft = true;
    if (event.key === 's') player2.moveDown = true;
    if (event.key === 'd') player2.moveRight = true;
};

function keyupHandler (event) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) {
        event.preventDefault();
        // Your current keydown handler logic here...
    }

    // Letters
    if(["a", "s", "d", "w"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        
    }
    if (event.key === 'ArrowUp') player.moveUp = false;
    if (event.key === 'ArrowDown') player.moveDown = false;
    if (event.key === 'ArrowLeft') player.moveLeft = false;
    if (event.key === 'ArrowRight') player.moveRight = false;

    // Player 2 controls
    if (event.key === 'w') player2.moveUp = false;
    if (event.key === 'a') player2.moveLeft = false;
    if (event.key === 's') player2.moveDown = false;
    if (event.key === 'd') player2.moveRight = false;
};

function getGemCount() {
    let count = 0;
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (gameMap[i][j] === 2) {
                count++;
            }
        }
    }
    return count;
}

function spawnGem() {
    if (getGemCount() >= maxGemCount) {
        return;
    }
    let validLocations = [];

    // Loop through each tile in the game map
    for (let x = 0; x < mapWidth; x++) {
        for (let y = 0; y < mapHeight - 1; y++) {
            // Check if the current tile and the tile below meet the criteria for a gem
            if (gameMap[y][x] === 0 && gameMap[y + 1][x] === 1) {
                // If they do, add the location to the array
                validLocations.push({x: x, y: y});
            }
        }
    }
    // If there are any valid locations, choose one at random
    if (validLocations.length > 0) {
        let location = validLocations[Math.floor(Math.random() * validLocations.length)];
        gameMap[location.y][location.x] = 2;
    }
}

function updateScoreDisplay() {
    document.getElementById('scorePlayer1').textContent = `Score: ${player.score}`;
    document.getElementById('scorePlayer2').textContent = `Score: ${player2.score}`;
}


function setPlayerSprite(currentGeneratingPlayer, left, right) {
    if(parseInt(currentGeneratingPlayer) === 1) {
        player.rightSprite.src = right;
        player.leftSprite.src = left;
        document.getElementById('player-sprite-1').src = right;
    } else {
        player2.rightSprite.src = right;
        player2.leftSprite.src = left;
        document.getElementById('player-sprite-2').src = right;
    }
}

setChangeSpriteCallback(setPlayerSprite);


document.getElementById("downloadButton").addEventListener("click", function() {
    saveMapImage();
});

function cleanMap(gameMap) {
    // Create a deep copy of gameMap
    let copiedMap = JSON.parse(JSON.stringify(gameMap));
    
    for (let i = 0; i < copiedMap.length; i++) {
        for (let j = 0; j < copiedMap[i].length; j++) {
            if (copiedMap[i][j] === 2) {
                copiedMap[i][j] = 0;
            }
        }
    }
    return copiedMap;
}

let identifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

function addURLParameter(paramName, paramValue) {
    let currentURL = new URL(window.location.href);
    currentURL.searchParams.set(paramName, paramValue);
    // This line will change the URL in the browser without reloading the page.
    window.history.pushState({}, '', currentURL.toString());
}
let copyButton = document.getElementById('copyButton');
let copiedMessage = document.getElementById('copiedMessage');

copyButton.addEventListener('click', function() {
    // Create a new textarea element and set its value to the URL string
    let textarea = document.createElement('textarea');
    textarea.value = shareLink.innerText;
    // Append the textarea to the body (it will not be visible)
    document.body.appendChild(textarea);
    // Select the textarea's contents
    textarea.select();
    // Copy the selected contents to the clipboard
    document.execCommand('copy');
    // Remove the textarea from the body
    document.body.removeChild(textarea);
    // Display the 'copied' message
    copiedMessage.innerText = 'Copied!';
    // Clear the 'copied' message after 2 seconds
    setTimeout(function() {
        copiedMessage.innerText = '';
    }, 2000);
});

document.addEventListener('DOMContentLoaded', (event) => {
    let shareButton = document.getElementById('shareButton');
    let shareModal = document.getElementById('shareModal');
    let closeShareModal = document.getElementById('closeShareModal');
    let closeShareModalFooter = document.getElementById('closeShareModalFooter');
    let shareLink = document.getElementById('shareLink');
  
    shareButton.addEventListener('click', function() {

        // Create a URL object from the backgroundImage.src
        let imgURL = new URL(backgroundImage.src);
        // Extract the pathname (i.e., the relative URL) from the URL object
        let imgPath = imgURL.pathname;
        if (imgPath.charAt(0) === "/") {
            imgPath = imgPath.substring(1);
        }
        let url = new URL(window.location.href);
        url.searchParams.set('map_name', imgPath);

        shareLink.innerText = url.toString();
        shareModal.classList.add('is-active');
    });
  
    closeShareModal.addEventListener('click', function() {
      shareModal.classList.remove('is-active');
    });
  
    closeShareModalFooter.addEventListener('click', function() {
      shareModal.classList.remove('is-active');
    });
  });



function saveMapImage() {
    // Create a temporary canvas and context
    document.getElementById('progressStatus').textContent = 'Submitted.';
    document.getElementById('progressContainer').style.display = "block";
    document.getElementById('progressBar').value = 3;
    const dataURL = getMapEditorImage();

    fetch('/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: dataURL,
            prompt: document.getElementById('levelDescription').value,
            mapData: cleanMap(gameMap),
            style: getCurrentStyle(),
            regenerate: currentImageStyle.style_name === getCurrentStyle().style_name,
            identifier: identifier // Send the identifier
        }),
    })
    .then(response => response.json())
    .then(data => {
        let img = new Image();
        img.onload = function() {
            newBackgroundImage = img;
            animationProgress = 0;  // Start animation
            changeBackgroundSound.cloneNode(true).play();
        }
        img.src = data.image;
        currentImageStyle = data.style;
        document.getElementById('progressContainer').style.display = "none";
        setIsEditMode(false);
        gameCanvas.focus();
        document.getElementById('editButton').textContent = isEditMode ? "Play Game" : "Edit Map";
        document.getElementById('progressBar').value = 100;
        document.getElementById('progressStatus').textContent = '';
        addURLParameter('map_name', data.image);
        
    })
    .catch((error) => {
    console.error('Error:', error);
    });
}

// hop to random style
function hopToRandomStyle() {
    let style = styles[Math.floor(Math.random() * styles.length)];
    setStyle(style.style_name);
    saveMapImage();
}

// Listen for the 'progress' event
socket.on('progress', function(data) {
    if (data.identifier === identifier) {
        let place_in_line = data.place_in_line;
        let statusLabel = document.getElementById('progressStatus');
        if (place_in_line > 0) {
            statusLabel.textContent = `${place_in_line - 1} request(s) ahead of you.`;
        } else {
            // Update your progress bar
            let progress = data.progress;
            statusLabel.textContent = `Drawing. ${parseInt(progress * 100)}% complete.`;
            document.getElementById('progressBar').value = progress * 100;
        }
    }
});

let i = 0;
let last_measure = Date.now();
let lastLoopTime = Date.now();
function gameLoop() {
    let loopStart = Date.now();
    let dt = (loopStart - lastLoopTime) / 1000;
    i += 1;
    if (i === 100) {
        let now = Date.now();
        let fps = 100 / ((now - last_measure) / 1000);
        last_measure = now;
        i = 0;
        document.getElementById("fps").textContent = `${parseInt(fps)} fps, ${player.vx}`;
    }
    if (isEditMode) {
        document.getElementById("edit-tools").style.display = "block";
    } else {
        document.getElementById("edit-tools").style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderBackgroundImage(ctx, dt);
        render_gems(ctx);
        updatePlayer(player, [player2], dt);
        updatePlayer(player2, [player], dt);
        updateParticles(dt);
        drawPlayer(player);
        drawPlayer(player2);
        drawParticles(ctx);
        renderForegroundImageParts(ctx, backgroundImage);
        updateScoreDisplay();
        const now = Date.now();
        if (now - lastGemSpawn > ((Math.random() * (maxGemSpawn - minGemSpawn) + minGemSpawn) * 1000)) {
            spawnGem();
            lastGemSpawn = now;
        }
    }
    lastLoopTime = loopStart;

    requestAnimationFrame(gameLoop);
}

respawnPlayer(player);
respawnPlayer(player2);
gameLoop();