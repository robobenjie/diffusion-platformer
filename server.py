import os
import numpy as np
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
import argparse
import threading
import time


import generate_images

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'your secret key'
socketio = SocketIO(app, cors_allowed_origins='*')
CORS(app)

styles = []

@app.route('/')
def index():
    return app.send_static_file('index.html')

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_style(folder, filename):
    try:
        style_file = '_'.join(filename.split('_')[2:]).replace('.png', '_style.json')
        with open(f'{folder}/{style_file}') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

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
        style = get_style(folder, filename)

        return jsonify({
            'map': map_data,
            'image': f'{folder}/{filename}',
            'style': style,
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
    style = get_style(random_dir, image_file)
    try:
        with open(f'{base_dir}/{random_dir}/map.json') as f:
            map_data = json.load(f)
        return jsonify({
            'map': map_data,
            'image': f'{base_dir}/{random_dir}/{image_file}',
            'style': style,
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


@app.route('/random_character', methods=['POST'])
def random_character():
    files = os.listdir('characters')
    data = request.get_json()
    num = data.get('num_requested', 1)
    ret = []
    for _ in range(num):
        rights = [f for f in files if not f.endswith('left.png')]
        right = random.choice(rights)
        ret.append({"right": f'characters/{right}', "left": f"characters/{right.replace('.png', '_left.png')}"})
    return jsonify(ret)

# Generate new character
@app.route('/generate_character', methods=['POST'])
def generate_character():
    data = request.get_json()
    prompt = data.get('prompt', 'videogame character')
    identifier = data.get('identifier', '')
    def callback(step=1, timestamp=0, latent=None, place_in_line=0):
        progress = step / generate_images.CHARACTER_NUM_STEPS
        socketio.emit('progress', {'progress': progress, 'identifier': identifier, 'place_in_line': place_in_line})
    names = generate_images.generateCharacters(prompt, num=4, callback=callback)
    return jsonify([{
        'right': f'characters/{name}.png',  
        'left': f"characters/{name}_left.png"
    } for name in names])

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
    with open('styles.json', 'w') as f:
        f.write("[\n")
        for l in styles:
            f.write(json.dumps(l) + ",\n")
        f.write(json.dumps(data) + "\n]")
    return jsonify(success=True), 200

def get_map_for_style(folder, style):
    json_files = [f for f in os.listdir(folder) if f.endswith('style.json')]
    np.random.shuffle(json_files)
    for json_file in json_files:
        with open(f'{folder}/{json_file}') as f:
            map_data = json.load(f)
        if map_data.get('style_name', 'source_name') == style.get('style_name', 'different_name'):
            return f'{folder}/background_image_{json_file.replace("_style.json", ".png")}'

@app.route('/save_style_maps', methods=['POST'])
def save_style_maps():
    data = request.get_json()
    folder = data.get('folderName', '')
    style_folder = os.path.join(folder, 'style_maps')
    os.makedirs(style_folder, exist_ok=True)
    for style_name, image_data in data.get('images', []):
        with open(f'{style_folder}/{style_name}.png', 'wb') as f:
            image_data = image_data.replace('data:image/png;base64,', '')
            image_bytes = base64.b64decode(image_data)
            image = Image.open(BytesIO(image_bytes))
            image.save(f)
    return jsonify(success=True), 200


@app.route('/save', methods=['POST'])
def save_image():
    data = request.get_json()
    image_data = data.get('image', '')
    promt = data.get('prompt', 'videogame level')
    map_object = data.get('mapData', 'NO MAP')
    style = data.get('style', {})
    
    map_bytes = json.dumps(map_object, sort_keys=True).encode()
    # Create a SHA-256 hash of the map data
    hash_object = hashlib.sha256(map_bytes)

    # Get the hexadecimal representation of the hash
    map_hash = hash_object.hexdigest()
    print(map_hash)
    folder = os.path.join("maps", map_hash)
    os.makedirs(folder, exist_ok=True)

    if not data.get('regenerate', False):
        image = get_map_for_style(folder, style)
        if image:
            return jsonify({
                'image': image,
                'style': style,
            })
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
    uid = uuid.uuid1()
    file_name = f'{folder}/background_image_{uid}.png'
    generated_background.save(file_name)
    with open (f'{folder}/{uid}_style.json', 'w') as f:
        f.write(json.dumps(style))

    # image.save(f'{folder}/prompt_image.png')
    with open(f'{folder}/map.json', 'w') as f:
        f.write(json.dumps(map_object))
    return jsonify({
        'image': file_name,
        'style': style,
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
   
def get_maps_to_create():
    base_dir = 'maps'

    # Result list for directories without corresponding style JSON
    missing_styles = []

    # Traverse directory structure
    for folder_name in os.listdir(base_dir):
        folder_path = os.path.join(base_dir, folder_name)
        if os.path.isdir(folder_path):
            style_maps_path = os.path.join(folder_path, 'style_maps')
            if os.path.exists(style_maps_path):
                # Get the style PNG names
                style_pngs = [f[:-4] for f in os.listdir(style_maps_path) if f.endswith('.png')] # removes '.png'
                # Get the style JSON names
                style_jsons = []
                for f in os.listdir(folder_path):
                    if f.endswith('_style.json'):
                        json_path = os.path.join(folder_path, f)
                        with open(json_path, 'r') as json_file:
                            data = json.load(json_file)
                            style_jsons.append(data.get('style_name'))
                # Check if any style PNGs don't have corresponding style JSON
                for style_png in style_pngs:
                    if style_png not in style_jsons:
                        missing_styles.append(f'{folder_path}/style_maps/{style_png}.png')
    return missing_styles

def background_task():
    maps_to_create = get_maps_to_create()
    np.random.shuffle(maps_to_create)
    for styled_image in maps_to_create:
        print(f'Background Rendering map for {styled_image}')
        style = [s for s in styles if s['style_name'] in styled_image][0]
        promt = style['prompt']
        generated_background = generate_images.getBackground(promt, Image.open(styled_image))
        uid = uuid.uuid1()
        folder = styled_image.split('/')[1]
        file_name = f'maps/{folder}/background_image_{uid}.png'
        generated_background[0].save(file_name)
        with open (f'maps/{folder}/{uid}_style.json', 'w') as f:
            f.write(json.dumps(style))

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start the Flask application.")
    parser.add_argument('--debug', action='store_true', help='Start the app in debug mode')
    parser.add_argument('--port', type=int, help='Specify the port number to use')
    parser.add_argument('--background-render', dest='background_render', action='store_true', help='Render images in the background')
    parser.set_defaults(background_render=False)
    parser.set_defaults(port=8000)
    args = parser.parse_args()

    if args.background_render:
        with app.app_context():
            load_styles()
            thread = threading.Thread(target=background_task)
            thread.daemon = True
            thread.start()

    socketio.run(app, debug=args.debug, port=args.port)