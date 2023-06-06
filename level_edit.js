
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
export const tileSize = 32;

export let gameMap = [  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
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
export let mapHeight = gameMap.length;
export let mapWidth = gameMap[0].length;
canvas.width = mapWidth * tileSize;
canvas.height = mapHeight * tileSize;

export function setMap(map) {
    console.log("Setting map");
    gameMap = map;
    mapHeight = gameMap.length;
    mapWidth = gameMap[0].length;
    canvas.width = mapWidth * tileSize;
    canvas.height = mapHeight * tileSize;
}

let mapChangeCallback = null;

export function setMapChangeCallback(callback) {
    mapChangeCallback = callback;
}

/*********************
 * Map Editing       *
 * ******************/
export let isEditMode = false;
let editStartMap = null;

export function setIsEditMode(editMode) {
    // Keep a copy of gameMap
    if (!isEditMode && editMode) {
      editStartMap = JSON.parse(JSON.stringify(gameMap));
    }
    // If we are leaving edit mode, check if the map has changed
    if (isEditMode && !editMode) {
        if (JSON.stringify(editStartMap) !== JSON.stringify(gameMap)) {
            if (mapChangeCallback) mapChangeCallback(getMapEditorImage());
        }
    }
    isEditMode = editMode;
}

let isMouseDown = false;
let action = null;
let shiftDown = false;

canvas.addEventListener("mousedown", function(event) {
    if (!isEditMode) return;
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / tileSize);
    const y = Math.floor((event.clientY - rect.top) / tileSize);

    action = gameMap[y][x] === 0 ? 1 : 0;
    gameMap[y][x] = action;

    if(shiftDown) applyToArea(x, y, action);
    
    drawMap(ctx);
}, false);

canvas.addEventListener("mousemove", function(event) {
    if (!isMouseDown || !isEditMode) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / tileSize);
    const y = Math.floor((event.clientY - rect.top) / tileSize);
    gameMap[y][x] = action;
    
    if(shiftDown) applyToArea(x, y, action);
    
    drawMap(ctx);
}, false);

canvas.addEventListener("mouseup", function(event) {
    isMouseDown = false;
}, false);

document.addEventListener('keydown', function(event) {
    if (event.key === 'Shift') {
        shiftDown = true;
    }
}, false);

document.addEventListener('keyup', function(event) {
    if (event.key === 'Shift') {
        shiftDown = false;
    }
}, false);

function applyToArea(x, y, action) {
    for(let i = Math.max(0, y - 1); i <= Math.min(gameMap.length - 1, y + 1); i++) {
        for(let j = Math.max(0, x - 1); j <= Math.min(gameMap[0].length - 1, x + 1); j++) {
            gameMap[i][j] = action;
        }
    }
}



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

function randomizeMap() {
    fetch('/create_random_map')
    .then(response => response.json())
    .then(data => {
        gameMap = data.map;
        drawMap(ctx);
        mapChangeCallback();
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}


document.getElementById('randomButton').addEventListener('click', function() {
    randomizeMap();
});

/******************************
 * Style Edit UI Controls       *
 * ****************************/

let levelDescription = "jungle temple ruins overgrown with vines and ferns, shafts of light";

// Get a reference to the text box
const levelDescriptionTextBox = document.getElementById('levelDescription');

// Add an event listener for the input event
levelDescriptionTextBox.addEventListener('input', function(event) {
    // Update the variable with the text box's current value
    levelDescription = event.target.value;
});

// Roughness Contols
let jaggy = false;
let numSections = 3;
let maxDeviation = 5;

let useGradient = false;
let backgroundBrightness = 0;
let architecture = true;

document.getElementById("editButton").addEventListener("click", function() {
    setIsEditMode(!isEditMode);
    this.textContent = isEditMode ? "Play Game" : "Edit Map";
    drawMap(ctx);
});


let gradientCheckbox = document.getElementById("gradientCheckbox");
gradientCheckbox.addEventListener("change", function() {
    useGradient = this.checked;
    drawMap(ctx);
    // Render the gradient if useGradient is true
});

// Add the event listener for when the slider value changes
let slider = document.getElementById("bgSlider");
slider.addEventListener("input", function() {
    backgroundBrightness = this.value;
    drawMap(ctx);
});

// Function to convert a number to a hexadecimal string
function toHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

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

// Change the architecture variable when the checkbox is clicked
document.getElementById('architectureToggle').addEventListener('change', (event) => {
    architecture = event.target.checked;
    drawMap(ctx);
});

/**********************
 * Styles             *
 * ********************/
export let styles = []
export function loadStyles() {
    return fetch('/styles')
        .then(response => response.json())
        .then(data => {
            styles = data;
            // Populate the dropdown with the style names
            let dropdown = document.getElementById('styleDropdown');
            styles.forEach(style => {
                let option = document.createElement('option');
                option.text = style.style_name;
                dropdown.add(option);
            });
            let option = document.createElement('option');
            option.text = "Custom";
            dropdown.add(option);

            // Randomly select a style on load
            let randomIndex = Math.floor(Math.random() * styles.length);
            dropdown.selectedIndex = randomIndex;
            setStyle(dropdown.options[randomIndex].text);
            // Add an event listener to update the style when a dropdown option is selected
            dropdown.addEventListener('change', function() {
                setStyle(this.value);
            });
            return styles;  // return the loaded styles
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

document.getElementById("saveStyle").addEventListener("click", function() {
    saveStyle();
});

export function getCurrentStyle() {
    return {
        style_name: document.getElementById('styleDropdown').value,
        prompt: levelDescription,
        backgroundBrightness: backgroundBrightness,
        architecture: architecture,
        useGradient: useGradient,
        jaggy: jaggy,
        numSections: numSections,
        maxDeviation: maxDeviation
    }
}

function saveStyle() {
    fetch('/save-style', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(getCurrentStyle()),
    })
}

export function saveAllStyleImages(folderName) {
    let startStyle = getCurrentStyle();
    let images = [];
    for(let i = 0; i < styles.length; i++) {
        let style = styles[i];
        setStyle(style.style_name);
        images.push([style.style_name, getMapEditorImage()]);
    }
    setStyle(startStyle.style_name);
    fetch('/save_style_maps', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({folderName: folderName, images: images}),
    })
}

export function setStyle(style_name) {
    // Find the style with the matching name
    if (style_name === 'Custom') {
        document.getElementById('style-edit-tools').style.display = 'block';
        setIsEditMode(true);
        drawMap(ctx);
        return;
    } else {
        document.getElementById('style-edit-tools').style.display = 'none';
    }
    let style = styles.find(s => s.style_name === style_name);
    if (!style) {
        console.error('Style not found:', style_name);
        return;
    }
    
    // Set the form inputs to match the style
    document.getElementById('styleDropdown').value = style.style_name;
    document.getElementById('architectureToggle').checked = style.architecture;
    architecture = style.architecture;
    document.getElementById('bgSlider').value = style.backgroundBrightness;
    backgroundBrightness = style.backgroundBrightness;
    document.getElementById('gradientCheckbox').checked = style.useGradient;
    useGradient = style.useGradient;
    document.getElementById('jaggyCheckbox').checked = style.jaggy;
    jaggy = style.jaggy;
    if (style.jaggy) {
        document.getElementById('jaggyControls').style.display = 'block';
    } else {
        document.getElementById('jaggyControls').style.display = 'none';
    }
    document.getElementById('sections').value = style.numSections;
    numSections = style.numSections;
    document.getElementById('deviation').value = style.maxDeviation;
    maxDeviation = style.maxDeviation;
    document.getElementById('styleName').value = style.style_name;
    document.getElementById('levelDescription').value = style.prompt;
    levelDescription = style.prompt;
    drawMap(ctx);
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

// Function to convert an RGB color to a darker version
function darkenColor(color, amount) {
    let [r, g, b] = color.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return "#" + toHex(r) + toHex(g) + toHex(b);
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


function interpolateColors(startColor, endColor, steps) {
    let start = {
        'r': parseInt(startColor.slice(1, 3), 16),
        'g': parseInt(startColor.slice(3, 5), 16),
        'b': parseInt(startColor.slice(5, 7), 16)
    }
    let end = {
        'r': parseInt(endColor.slice(1, 3), 16),
        'g': parseInt(endColor.slice(3, 5), 16),
        'b': parseInt(endColor.slice(5, 7), 16)
    }
    let diff = {
        'r': end['r'] - start['r'],
        'g': end['g'] - start['g'],
        'b': end['b'] - start['b']
    }
    let stepsRGB = {
        'r': diff['r'] / (steps - 1),
        'g': diff['g'] / (steps - 1),
        'b': diff['b'] / (steps - 1)
    }
    let colorArr = [];
    for(let i = 0; i < steps; i++) {
        let r = Math.round(start['r'] + stepsRGB['r'] * i).toString(16).padStart(2, '0');
        let g = Math.round(start['g'] + stepsRGB['g'] * i).toString(16).padStart(2, '0');
        let b = Math.round(start['b'] + stepsRGB['b'] * i).toString(16).padStart(2, '0');
        colorArr.push('#' + r + g + b);
    }
    return colorArr;
}


function text(ctx, words, y_offset) {
    // Set font properties
ctx.font = '150px Impact'; // Change the size and font to what you want
ctx.fillStyle = '#dfdfdf'; // Change to the color you want

let text = words
let textWidth = ctx.measureText(text).width;

// Calculate the starting coordinates
let x = (canvas.width - textWidth) / 2;
let y = canvas.height / 2;
ctx.strokeStyle = "white"; 
ctx.lineWidth = 15; 

// Write the text
//ctx.fillText(text, x, y + y_offset);
//ctx.strokeText(text, x, y + y_offset);
ctx.fillStyle = "#757575"
ctx.fillText(text, x, y + y_offset);
ctx.fillStyle = '#dfdfdf'; // Change to the color you want
// let colors = interpolateColors("#757575","#000000",  10);
let colors = interpolateColors("#757575", '#dfdfdf',  10);
for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillText(text, x + (colors.length - i), y + y_offset - (colors.length - i));
}
ctx.fillText(text, x, y + y_offset);
}

export function getMapEditorImage() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapWidth * tileSize;
    tempCanvas.height = mapHeight * tileSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the map on the temporary canvas
    drawMap(tempCtx);

    // Generate the data URL and create an anchor element to download the image
    return tempCanvas.toDataURL('image/png');
}

export function drawMap(tmpCtx, wallColor = '#989898', topColor = '#dfdfdf') {
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
    /*
    text(tmpCtx, "DIMENSION", -90)
    text(tmpCtx, "HOPPER", 50)
    */
}
