import os
import time
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import random
import base64
from PIL import Image
from io import BytesIO
import hashlib
import json
from collections import defaultdict
import random
import uuid


import generate_images

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'your secret key'
socketio = SocketIO(app)
styles = []

@app.route('/')
def index():
    return app.send_static_file('index.html')

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/get_map', methods=['POST'])
def get_map():
    data = request.get_json()
    map_path = data.get('map_path', '')
    if map_path == 'random':
        return random_map()
    if not map_path:
        return random_map(logo=True)
    folder, filename = os.path.split(map_path)
    try:
        with open(f'{folder}/map.json') as f:
            map_data = json.load(f)

        return jsonify({
            'map': map_data,
            'image': f'{folder}/{filename}'
        })
    except (FileNotFoundError, IndexError):
        print(f'Error loading map {folder}')
        return random_map(logo=True)

def random_map(logo=False):
    if logo:
        base_dir = 'logo_maps'
    else:
        base_dir = 'maps'
    map_dirs = os.listdir(base_dir)
    choices = []
    for map_dir in map_dirs:
        for f in [f for f in os.listdir(f'{base_dir}/{map_dir}') if f.endswith('.png')]:
            choices.append((map_dir, f))
    random_dir, image_file = random.choice(choices)
    try:
        with open(f'{base_dir}/{random_dir}/map.json') as f:
            map_data = json.load(f)
        return jsonify({
            'map': map_data,
            'image': f'{base_dir}/{random_dir}/{image_file}'
        })
    except (FileNotFoundError, IndexError):
        print(f'Error loading map {random_dir}')
        return random_map()

@app.route('/random_collectible', methods=['GET'])
def random_collectible():
    files = os.listdir('collectibles')
    return jsonify({
        'image': f'collectibles/{random.choice(files)}'
    })


@app.route('/random_character', methods=['GET'])
def random_character():
    files = os.listdir('characters')
    rights = [f for f in files if not f.endswith('left.png')]
    right = random.choice(rights)
    return jsonify({
        'right': f'characters/{right}',
        'left': f"characters/{right.replace('.png', '_left.png')}"
    })

# Generate new character
@app.route('/generate_character', methods=['POST'])
def generate_character():
    data = request.get_json()
    prompt = data.get('prompt', 'videogame character')
    identifier = data.get('identifier', '')
    def callback(step=1, timestamp=0, latent=None, place_in_line=0):
        progress = step / generate_images.CHARACTER_NUM_STEPS
        socketio.emit('progress', {'progress': progress, 'identifier': identifier, 'place_in_line': place_in_line})
    name = generate_images.generateCharacter(prompt, callback=callback)
    return jsonify({
        'right': f'characters/{name}.png',
        'left': f"characters/{name}_left.png"
    })

def load_styles():
    global styles
    with open('styles.json') as f:
        styles = json.load(f)

# Endpoint for getting all styles
@app.route('/styles', methods=['GET'])
def get_styles():
    load_styles()
    return jsonify(styles)

@app.route('/save-style', methods=['POST'])
def save_style():
    load_styles()
    data = request.get_json()
    print(data)
    styles.append(data)
    with open('styles.json', 'w') as f:
        f.write(json.dumps(styles))
    return jsonify(success=True), 200

@app.route('/save', methods=['POST'])
def save_image():
    data = request.get_json()
    image_data = data.get('image', '')
    promt = data.get('prompt', 'videogame level')
    map_object = data.get('mapData', 'NO MAP')
    map_bytes = json.dumps(map_object, sort_keys=True).encode()
    print(map_object)
    # Create a SHA-256 hash of the map data
    hash_object = hashlib.sha256(map_bytes)

    # Get the hexadecimal representation of the hash
    map_hash = hash_object.hexdigest()
    print(map_hash)
    folder = os.path.join("maps", map_hash)
    os.makedirs(folder, exist_ok=True)

    # remove 'data:image/png;base64,' from the start of the data URL
    image_data = image_data.replace('data:image/png;base64,', '')
    # decode the base64 data to bytes

    image_bytes = base64.b64decode(image_data)
    image = Image.open(BytesIO(image_bytes))

    identifier = data.get('identifier', '')
    def callback(step=1, timestamp=0, latent=None, place_in_line=0):
        progress = step / generate_images.NUM_STEPS
        socketio.emit('progress', {'progress': progress, 'identifier': identifier, 'place_in_line': place_in_line})
    generated_background = generate_images.getBackground(promt, image, callback=callback)[0]
    file_name = f'{folder}/background_image_{uuid.uuid1()}.png'
    generated_background.save(file_name)

    # image.save(f'{folder}/prompt_image.png')
    with open(f'{folder}/map.json', 'w') as f:
        f.write(json.dumps(map_object))
    return jsonify({
        'image': file_name
    })

@app.route('/create_random_map', methods=['GET'])
def get_random_map():
    width = 25
    jump_prob = 0.5
    maps = []
    folder = 'maps/'

    # Traverse directory with all files
    for root, dirs, files in os.walk(folder):
        for file in files:
            # Check for .json extension
            if file.endswith('.json'):
                with open(os.path.join(root, file), 'r') as json_file:
                    map_data = json.load(json_file)
                    maps.append(map_data)
    # The starting map
    # Dictionary to hold columns and the maps that contain them
    column_maps = defaultdict(list)

    # Iterate over all maps and all columns in each map
    for map_index, currMap in enumerate(maps):
        map_t = list(zip(*currMap))  # Transpose the map to work with columns
        for col_index, column in enumerate(map_t):
            # Convert column to tuple to use it as a dictionary key
            column_tuple = tuple(column)
            # Add the map index and column index to the list for this column
            column_maps[column_tuple].append((map_index, col_index))

    random_start_index = random.randint(0, len(maps) - 1)
    map_t = list(zip(*maps[random_start_index]))

    # The new map starts with the first column of the starting map
    new_map_t = [map_t[0]]

    while len(new_map_t) < width:
        last_column = new_map_t[-1]
        if last_column in column_maps and random.random() < jump_prob:
            # There is a chance to jump to another map
            new_map_index, new_col_index = random.choice(column_maps[last_column])
            # Make sure the column is not further than current column
            if new_col_index < len(new_map_t):
                map_t = list(zip(*maps[new_map_index]))  # Switch to the new map
                # Continue from the new column index
                new_map_t.append(map_t[new_col_index])
        else:
            # Continue with the next column in the current map, or a random column if at the end
            if len(new_map_t) < len(map_t):
                new_map_t.append(map_t[len(new_map_t)])
            else:
                new_map_t.append(random.choice(list(column_maps.keys())))
    # Transpose the new map back to row-major order
    new_map = list(zip(*new_map_t))
    return jsonify({
            'map': new_map,
            })
   
@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    socketio.run(app, port=8000)