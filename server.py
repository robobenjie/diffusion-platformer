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


import generate_images

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'your secret key'
socketio = SocketIO(app)

@app.route('/')
def index():
    return app.send_static_file('index.html')

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/random_map', methods=['GET'])
def random_map():
    map_dirs = os.listdir('maps')
    random_dir = random.choice(map_dirs)

    with open(f'maps/{random_dir}/map.json') as f:
        map_data = json.load(f)

    image_file = random.choice([f for f in os.listdir(f'maps/{random_dir}') if f.endswith('.png')])

    return jsonify({
        'map': map_data,
        'image': f'maps/{random_dir}/{image_file}'
    })

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
    def callback(step, timestamp, latent):
        progress = step / generate_images.NUM_STEPS
        socketio.emit('progress', {'progress': progress, 'identifier': identifier})
    generated_background = generate_images.getBackground(promt, image, callback=callback)[0]
    file_name = f'{folder}/background_image_{time.time()}.png'
    generated_background.save(file_name)

    # image.save(f'{folder}/prompt_image.png')
    with open(f'{folder}/map.json', 'w') as f:
        f.write(json.dumps(map_object))
    return jsonify({
        'image': file_name
    })
   
@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    socketio.run(app, port=8000)