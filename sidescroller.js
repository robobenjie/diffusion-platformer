const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 32;
const collisionBoxWidthFraction = 0.5;

// Constants for gem spawning
const minGemSpawn = 1; // Minimum seconds between gem spawns
const maxGemSpawn = 5; // Maximum seconds between gem spawns
const maxGemCount = 4; // Maximum number of gems on the screen at once
// Initialize lastGemSpawn to the current time

let socket = io();

let lastGemSpawn = Date.now();

let backgroundImage = new Image();
let collectibleImage = new Image();

//backgroundImage.src = "example_background.png";


// 0 = open space, 1 = wall/floor

let gameMap = [  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
[1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
[0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
[0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
[0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
[0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
[0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
[0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
[1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
[0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
[0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
[0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
[0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
[1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]
const mapHeight = gameMap.length;
const mapWidth = gameMap[0].length;
canvas.width = mapWidth * tileSize;
canvas.height = mapHeight * tileSize;

window.onload = function() {
    fetch('/random_map')
    .then(response => response.json())
    .then(data => {
        gameMap = data.map;
        backgroundImage.src = data.image;
        respawnPlayer(player);
        respawnPlayer(player2);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
    fetch('/random_collectible')
    .then(response => response.json())
    .then(data => {
        collectibleImage.src = data.image;
    })
    randomizePlayerSprite(player);
    randomizePlayerSprite(player2);
}

function randomizePlayerSprite(player) {
    fetch('/random_character')
    .then(response => response.json())
    .then(data => {
        player.rightSprite.src = data.right;
        player.leftSprite.src = data.left;
    });
}

/********************************/
/*      DRAW MAP                */
/********************************/

function drawJaggedLine(ctx, x1, y1, x2, y2) {
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

    // Draw to the end point
    ctx.lineTo(x2, y2);
    ctx.closePath();

    ctx.fill();
}

function drawBlock(tmpCtx, i, j, color) {
    tmpCtx.fillStyle = color;
    if (jaggy) {
        drawJaggedLine(tmpCtx, j * tileSize, (i + 1) * tileSize, j * tileSize, i * tileSize); // Left edge
        drawJaggedLine(tmpCtx, (j + 1) * tileSize, (i + 1) * tileSize, j * tileSize, (i + 1) * tileSize); // Bottom edge
        drawJaggedLine(tmpCtx, (j + 1) * tileSize, i * tileSize, (j + 1) * tileSize, (i + 1) * tileSize); // Right edge
    }
    tmpCtx.fillRect(j * tileSize, i * tileSize, tileSize, tileSize);
}

function drawMap(tmpCtx, wallColor = '#989898', topColor = '#dfdfdf') {
    // Overhang factor
    let overhangFactor = 0.15;
    let roundedFactor = 0.2;

    // Draw the background
    const buildingInterior = '#757575'; // Change this to your desired color

    tmpCtx.fillStyle = darkenColor(wallColor, 255 - backgroundBrightness);;
    tmpCtx.fillRect(0, 0, mapWidth * tileSize, mapHeight * tileSize);

    // Draw the cave-stye gradient
    if (useGradient) {
        let gradient = tmpCtx.createLinearGradient(0, 0, 0, tmpCtx.canvas.height);
        let middleColor = darkenColor(buildingInterior, 255 - backgroundBrightness);
        gradient.addColorStop(0, wallColor);
        gradient.addColorStop(0.5, middleColor);
        gradient.addColorStop(1, wallColor);
        tmpCtx.fillStyle = gradient;
        tmpCtx.fillRect(0, 0, tmpCtx.canvas.width, tmpCtx.canvas.height);
    }

    // Fill building backgrounds
    if (architecture) {
        for (let j = 0; j < mapWidth; j++) {
            let seenWall = false;
            for (let i = 0; i < mapHeight; i++) {
                if (gameMap[i][j] === 1) {
                    seenWall = true;
                    continue;
                }
                if (seenWall) {
                    drawBlock(tmpCtx, i, j, buildingInterior);
                }
            }
        }
    }



    // Draw the walls
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (gameMap[i][j] === 1) {
                // Draw base square
                if (gameMap[i][j] === 1) {
                    // Use the drawJaggedLine function to draw each side of the rectangle
                    drawBlock(tmpCtx, i, j, wallColor);
                }
            }
        }
    }

    // Draw the lighter top rectangles
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (gameMap[i][j] === 1 && gameMap[i - 1] !== undefined && gameMap[i - 1][j] !== 1) {
                tmpCtx.fillStyle = topColor;
                let heightRatio = 0.15;
                tmpCtx.beginPath();
                tmpCtx.moveTo((j * tileSize) + tileSize * overhangFactor, (i * tileSize) - tileSize * heightRatio);
                tmpCtx.lineTo((j * tileSize) + tileSize * (1 - overhangFactor), (i * tileSize) - tileSize * heightRatio);
                tmpCtx.quadraticCurveTo(
                    (j * tileSize) + tileSize * (1 + overhangFactor),
                    (i * tileSize) - tileSize * heightRatio,
                    (j * tileSize) + tileSize * (1 + overhangFactor),
                    (i * tileSize));
                tmpCtx.lineTo((j * tileSize) + tileSize * (1 + overhangFactor), (i * tileSize) + tileSize * heightRatio);
                tmpCtx.lineTo((j * tileSize) - tileSize * overhangFactor, (i * tileSize) + tileSize * heightRatio);
                tmpCtx.quadraticCurveTo(
                    (j * tileSize) - tileSize * overhangFactor, 
                    (i * tileSize) - tileSize * heightRatio, 
                    (j * tileSize) + tileSize * 0.1, 
                    (i * tileSize) - tileSize * heightRatio);
                tmpCtx.fill();
            }
        } 
    }
}

function renderBackgroundImage(ctx, image) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function renderForegroundImageParts(ctx, foregroundImage) {
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (gameMap[i][j] === 1) {               
                // The dx, dy, dWidth, dHeight parameters specify where on the canvas to draw that portion of the image
                topBuffer = tileSize * 0.15;
                let dx = j * tileSize;
                let dy = i * tileSize - topBuffer;
                let dWidth = tileSize;
                let dHeight = tileSize + topBuffer;
                
                // Draw the portion of the image that corresponds to the wall section on the canvas
                ctx.drawImage(foregroundImage, dx, dy, dWidth, dHeight, dx, dy, dWidth, dHeight);
            }
        }
    }
}

function render_gems(ctx) {
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {

            let currentTimeInSeconds = Date.now() / 1000;
            let sinusoid = Math.sin(currentTimeInSeconds * 2.0 + i + j) * 4;

            if(gameMap[i][j] === 2) {
                // render collectible_image
                ctx.drawImage(collectibleImage, j * tileSize, i * tileSize + sinusoid, collectibleImage.height, collectibleImage.width);
            }
        }
    }
}


/******************************************************
 **                PLAYER CONTROLS                   **
 ******************************************************/

const playerConfig = {
    speed: 4,
    size: tileSize / 2 - 2,
    ax: 0.2,
    maxVx: 2,
    friction: 0.9,
    gravity: 0.25,
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
player.rightSprite.src = "characters/charlie.png";
player.leftSprite.src = "characters/charlie_left.png";

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
player2.rightSprite.src = "characters/druid.png";
player2.leftSprite.src = "characters/druid_left.png";

function drawPlayer(player) {
    // Define the width and height of each frame
    
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

    // adjust for sprite center
    var playerX = player.x - frameWidth / 2;
    var playerY = player.y - frameHeight / 2;

    // Save the current context
  
    const heightOffset = 20;

    ctx.drawImage(playerSprite, frameX, 0, frameWidth, frameHeight, player.x - frameWidth / 2, player.y - frameHeight / 2 - heightOffset, frameWidth, frameHeight);
}

// Create an array to hold the particles
let particles = [];
let particleSize = 5;
const playerExplosionCount = 20;
const particleGravity = 0.1;
const particleExplotionSpeed = 2;

// When the player is killed
function playerKilled(player) {
    // Break the player sprite into particles
    for (let i = 0; i < playerExplosionCount; i += 1) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() * 2 - 1) * particleExplotionSpeed,
            vy: (Math.random() * 2 - 1) * particleExplotionSpeed,
            size: particleSize,
            lifespan: 100
        });
    }
}

// Update the particles each frame
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += particleGravity;
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

function getCollidingPlayers(currentPlayer, otherPlayers, x, y, buffer = 0) {
    return otherPlayers.filter(player => {
        const dx = x - player.x;
        const dy = y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= currentPlayer.size + player.size + buffer;
    });
}

function updatePlayer(currentPlayer, otherPlayers) {
    if (!isInGameArea(currentPlayer.x, currentPlayer.y)) {
        respawnPlayer(currentPlayer);
        return
    }
    // Horizontal movement
    if (currentPlayer.moveLeft && currentPlayer.vx > -currentPlayer.maxVx) {
        currentPlayer.vx -= currentPlayer.ax;
    } else if (currentPlayer.moveRight && currentPlayer.vx < currentPlayer.maxVx) {
        currentPlayer.vx += currentPlayer.ax;
    } else {
        currentPlayer.vx *= currentPlayer.friction;
    }

    // Check for kills
    getCollidingPlayers(currentPlayer, otherPlayers, currentPlayer.x, currentPlayer.y, 5).forEach((collidingPlayer) => {
        const AbsDeltaX = Math.abs(currentPlayer.x - collidingPlayer.x);
        const AbsDeltaY = Math.abs(currentPlayer.y - collidingPlayer.y);
        if (collidingPlayer.y > currentPlayer.y + currentPlayer.size * 2 && AbsDeltaX < currentPlayer.size && currentPlayer.vy > 0) {
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
        currentPlayer.vy = -5;
        currentPlayer.isJumping = true;
    }
    if (currentPlayer.moveUp) {
        currentPlayer.vy += currentPlayer.gravity * 0.3;
    } else {
        currentPlayer.vy += currentPlayer.gravity;
    }
    currentPlayer.y += currentPlayer.vy;

    // Vertical collision
    if (isColliding(currentPlayer.x, currentPlayer.y + currentPlayer.size / 2, collisionBoxWidthFraction * currentPlayer.size) && currentPlayer.vy >= 0) { // Ground collision
        currentPlayer.y = Math.floor((currentPlayer.y + currentPlayer.size / 2) / tileSize) * tileSize - currentPlayer.size / 2;
        currentPlayer.isJumping = false;
        currentPlayer.vy = 0;
    } else if (isColliding(currentPlayer.x, currentPlayer.y - currentPlayer.size / 2, collisionBoxWidthFraction * currentPlayer.size)) { // Ceiling collision
        currentPlayer.y = Math.ceil((currentPlayer.y - currentPlayer.size / 2) / tileSize) * tileSize + currentPlayer.size / 2;
        currentPlayer.vy = 0.01; // Math.Min(0, currentPlayer.vy);
    }
    const gemX = Math.floor(currentPlayer.x / tileSize);
    const gemY = Math.floor(currentPlayer.y / tileSize);
    if (gameMap[gemY][gemX] === 2) {
        gameMap[gemY][gemX] = 0;
        currentPlayer.score += 1;
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') player.moveUp = true;
    if (event.key === 'ArrowDown') player.moveDown = true;
    if (event.key === 'ArrowLeft') player.moveLeft = true;
    if (event.key === 'ArrowRight') player.moveRight = true;

    // Player 2 controls
    if (event.key === 'w') player2.moveUp = true;
    if (event.key === 'a') player2.moveLeft = true;
    if (event.key === 's') player2.moveDown = true;
    if (event.key === 'd') player2.moveRight = true;
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowUp') player.moveUp = false;
    if (event.key === 'ArrowDown') player.moveDown = false;
    if (event.key === 'ArrowLeft') player.moveLeft = false;
    if (event.key === 'ArrowRight') player.moveRight = false;

    // Player 2 controls
    if (event.key === 'w') player2.moveUp = false;
    if (event.key === 'a') player2.moveLeft = false;
    if (event.key === 's') player2.moveDown = false;
    if (event.key === 'd') player2.moveRight = false;
});

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
    document.getElementById('scorePlayer1').textContent = `Player 1 Score: ${player.score}`;
    document.getElementById('scorePlayer2').textContent = `Player 2 Score: ${player2.score}`;
}

/******************************
 * Map Edit UI Controls       *
 * ****************************/

let isEditMode = false;

document.getElementById("editButton").addEventListener("click", function() {
    isEditMode = !isEditMode;
    this.textContent = isEditMode ? "Play Game" : "Edit Map";
    drawMap(ctx);
});


// Roughness Contols
let jaggy = false;
let numSections = 3;
let maxDeviation = 5;

// Change the architecture variable when the checkbox is clicked
document.getElementById('jaggyCheckbox').addEventListener('change', (event) => {
    jaggy = event.target.checked;
    drawMap(ctx);
    if (jaggy) {
        document.getElementById("jaggyControls").style.display = "block";
    } else {
        document.getElementById("jaggyControls").style.display = "none";
    }
});

// Initialize slider values and displays
document.getElementById('sections').value = numSections;
document.getElementById('sections-value').textContent = numSections;
document.getElementById('deviation').value = maxDeviation;
document.getElementById('deviation-value').textContent = maxDeviation;

// Update the number of sections
document.getElementById('sections').addEventListener('input', function(event) {
  numSections = parseInt(event.target.value);
  document.getElementById('sections-value').textContent = numSections;
  drawMap(ctx);
});

// Update the maximum deviation
document.getElementById('deviation').addEventListener('input', function(event) {
  maxDeviation = parseInt(event.target.value);
  document.getElementById('deviation-value').textContent = maxDeviation;
  drawMap(ctx);
});


let architecture = true;
// Change the architecture variable when the checkbox is clicked
document.getElementById('architectureToggle').addEventListener('change', (event) => {
    architecture = event.target.checked;
    drawMap(ctx);
});

document.getElementById('changeCharacter1').addEventListener('click', function() {
    randomizePlayerSprite(player);
});
document.getElementById('changeCharacter2').addEventListener('click', function() {
    randomizePlayerSprite(player2);
});



/******************************
 * Generate Character Code    *
 * ****************************/

let currentGeneratingPlayer;

let types = ["boy", "girl", "robot", "woman", "knight", "ninja", "wizard", "pirate", "man", "monster"];
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

document.getElementById('submitCharacter').addEventListener('click', function() {
    // Handle form submission here
    // Get the value with: document.getElementById('characterDescription').value
    console.log('Generating character for player ' + currentGeneratingPlayer + document.getElementById('characterDescription').value);
    document.getElementById('generateCharacterModal').classList.remove('is-active');
    document.getElementById('progressContainer').style.display = "block";
    document.getElementById('progressBar').value = 3;
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
        document.getElementById('progressBar').value = 100;
        if(currentGeneratingPlayer === '1') {
            player.rightSprite.src = data.right;
            player.leftSprite.src = data.left;
        } else {
            player2.rightSprite.src = data.right;
            player2.leftSprite.src = data.left;
        }
    })
    .catch((error) => {
    console.error('Error:', error);
    });
});



document.getElementById('clearButton').addEventListener('click', function() {
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            if (i < mapHeight - 1) {
                gameMap[i][j] = 0;
            } else {
                gameMap[i][j] = 1;
            }
        }
    }
    // Redraw the map
    drawMap(ctx);
});

document.getElementById('fillButton').addEventListener('click', function() {
    for (let i = 0; i < mapHeight; i++) {
        for (let j = 0; j < mapWidth; j++) {
            gameMap[i][j] = 1;
        }
    }
    // Redraw the map
    drawMap(ctx);
});

let levelDescription = "jungle temple ruins overgrown with vines and ferns, shafts of light";

// Get a reference to the text box
const levelDescriptionTextBox = document.getElementById('levelDescription');

// Add an event listener for the input event
levelDescriptionTextBox.addEventListener('input', function(event) {
    // Update the variable with the text box's current value
    levelDescription = event.target.value;
});

document.getElementById("downloadButton").addEventListener("click", function() {
    saveMapImage();
});

let useGradient = false;
let gradientCheckbox = document.getElementById("gradientCheckbox");
gradientCheckbox.addEventListener("change", function() {
    useGradient = this.checked;
    drawMap(ctx);
    // Render the gradient if useGradient is true
});

let backgroundBrightness = 0;

// Function to convert a number to a hexadecimal string
function toHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

// Function to convert an RGB color to a darker version
function darkenColor(color, amount) {
    let [r, g, b] = color.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

// Get the slider
let slider = document.getElementById("bgSlider");

// Add the event listener for when the slider value changes
slider.addEventListener("input", function() {
    backgroundBrightness = this.value;
    drawMap(ctx);
});


canvas.addEventListener("click", function(event) {
    if (!isEditMode) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / tileSize);
    const y = Math.floor((event.clientY - rect.top) / tileSize);

    // Toggle the tile at the clicked location
    gameMap[y][x] = gameMap[y][x] === 0 ? 1 : 0;
    // Display the map
    const mapContainer = document.getElementById('mapDisplay');
    let formattedMap = '[';
    gameMap.forEach((row, i) => {
        formattedMap += '  [' + row.join(', ') + ']';
        formattedMap += i !== gameMap.length - 1 ? ',\n' : ']';
    });
    mapContainer.textContent = formattedMap;
    drawMap(ctx);
}, false);

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

function saveMapImage() {
    // Create a temporary canvas and context
    document.getElementById('progressContainer').style.display = "block";
    document.getElementById('progressBar').value = 3;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapWidth * tileSize;
    tempCanvas.height = mapHeight * tileSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the map on the temporary canvas
    drawMap(tempCtx);

    // Generate the data URL and create an anchor element to download the image
    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'map.png';
    //link.click();

    fetch('/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: dataURL,
            prompt: levelDescription,
            backgroundBrightness: backgroundBrightness,
            architecture: architecture,
            useGradient: useGradient,
            jaggy: jaggy,
            numSections: numSections,
            maxDeviation: maxDeviation,
            mapData: cleanMap(gameMap),
            identifier: identifier // Send the identifier
        }),
    })
    .then(response => response.json())
    .then(data => {
        backgroundImage.src = data.image;
        document.getElementById('progressContainer').style.display = "none";
        isEditMode = false;
        document.getElementById('progressBar').value = 100;
    })
    .catch((error) => {
    console.error('Error:', error);
    });


}

// Listen for the 'progress' event
socket.on('progress', function(data) {
    if (data.identifier === identifier) {
        // Update your progress bar
        let progress = data.progress;
        // Assume your progress bar is a div with id "progressBar"
        document.getElementById('progressBar').value = progress * 100;
        
    }
});


function gameLoop() {

    if (isEditMode) {
        document.getElementById("edit-tools").style.display = "block";
    } else {
        document.getElementById("edit-tools").style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderBackgroundImage(ctx, backgroundImage);
        render_gems(ctx);
        updatePlayer(player, [player2]);
        updatePlayer(player2, [player]);
        updateParticles();
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

    requestAnimationFrame(gameLoop);
}

respawnPlayer(player);
respawnPlayer(player2);
gameLoop();
