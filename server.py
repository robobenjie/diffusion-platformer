import os
import numpy as np
from flask import Flask, send_from_directory, request, jsonify, redirect, url_for
from flask_cors import CORS
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
from flask import render_template
import glob


import generate_images
import map_creation

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'your secret key'
CORS(app)

styles = []

in_progress_generations = defaultdict(dict)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/images')
def images():
    page = request.args.get('page', default=1, type=int)
    images, has_next = get_images(page)

    return render_template('images.html', images=images, page=page, has_next=has_next)


def get_images(page):
    image_dir = 'maps'  # Directory where your images are stored
    images_per_page = 50

    all_images = []
    folders = glob.glob(os.path.join(image_dir, '*'))
    
    for folder in folders:
        if not os.path.isdir(folder):
            continue  # Skip non-directory files
        
        folder_name = os.path.basename(folder)
        image_files = glob.glob(os.path.join(folder, '*.png'))
        
        for image_file in image_files:
            image_name = os.path.splitext(os.path.basename(image_file))[0]
            image_path = os.path.relpath(image_file, image_dir)
            image_url = f'/maps/{image_path}'  # Adjust the URL path as per your Flask routes
            all_images.append({
                'name': image_name,
                'url': image_url,
                'path': image_path
            })

    # Paginate the images
    start_index = (page - 1) * images_per_page
    end_index = start_index + images_per_page
    paginated_images = all_images[start_index:end_index]

    # Determine if there are more images
    has_next = end_index < len(all_images)

    return paginated_images, has_next


@app.route('/process_images', methods=['POST'])
def process_images():
    selected_images = request.form.getlist('selected_images')
    # Append selected_images to featatured.txt
    with open('featured.txt', 'a') as f:
        for image in selected_images:
            f.write(image + '\n')
    # Redirect to the next page URL
    current_page = request.form.get('page', default=1, type=int)
    next_page = current_page + 1
    return redirect(url_for('images', page=next_page))


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

import os
import json
import random
from flask import jsonify

def random_map(logo=False):
    if logo:
        base_dir = 'logo_maps'
    else:
        base_dir = 'maps'
    
    # Check if featured.txt exists
    if not logo and os.path.exists('featured.txt'):
        with open('featured.txt', 'r') as f:
            featured_images = f.read().splitlines()
        if featured_images:  # Check if the list is not empty
            image_path = random.choice(featured_images)
            if os.path.exists(image_path):
                # Construct the response and return
                map_data = {}
                try:
                    with open(f'{image_path.rsplit("/", 1)[0]}/map.json') as f:
                        map_data = json.load(f)
                except (FileNotFoundError, json.JSONDecodeError):
                    print(f'Error loading map for {image_path}')
                style = get_style(*image_path.rsplit("/", 2)[1:])  # Assuming get_style takes directory and filename
                return jsonify({
                    'map': map_data,
                    'image': image_path,
                    'style': style,
                })

    # Fallback to old behavior
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

    if "character_names" in in_progress_generations[identifier]:
        return jsonify([{
            'right': f'characters/{name}.png',  
            'left': f"characters/{name}_left.png"
        } for name in in_progress_generations[identifier]["character_names"]])
    
    if "started" not in in_progress_generations[identifier]:

        def callback(step=1, timestamp=0, latent=None, place_in_line=0):
            progress = step / generate_images.CHARACTER_NUM_STEPS
            in_progress_generations[identifier]["progress"] = progress
            in_progress_generations[identifier]["place_in_line"] = place_in_line
        def work():
            in_progress_generations[identifier]["character_names"] = generate_images.generateCharacters(prompt, num=4, callback=callback)
        thread = threading.Thread(target=work)
        thread.daemon = True
        thread.start()
        in_progress_generations[identifier]["started"] = True
        return jsonify(success=True), 200
    if "progress" in in_progress_generations[identifier]:
        return jsonify({
            "progress": in_progress_generations[identifier]["progress"],
            "place_in_line": in_progress_generations[identifier]["place_in_line"]
        })
    return jsonify(success=True), 200

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

@app.route('/save_challenge', methods=['POST'])
def save_challenge():
    data = request.get_json()
    challenge_id = uuid.uuid4().hex
    with open(f'challenges/{challenge_id}.json', 'w') as f:
        json.dump(data, f)
    return jsonify(challenge_id=challenge_id, success=True), 200

@app.route('/load_challenge', methods=['POST'])
def load_challenge():
    data = request.get_json()
    challenge_id = data.get('challenge_id', '')
    with open(f'challenges/{challenge_id}.json') as f:
        challenge_data = json.load(f)
    return jsonify(challenge_data=challenge_data, success=True), 200

@app.route('/save', methods=['POST'])
def save_image():
    data = request.get_json()
    image_data = data.get('image', '')
    prompt = data.get('prompt', 'videogame level')
    map_object = data.get('mapData', 'NO MAP')
    style = data.get('style', {})
    identifier = data.get('identifier', '')

    map_bytes = json.dumps(map_object, sort_keys=True).encode()
    hash_object = hashlib.sha256(map_bytes)
    map_hash = hash_object.hexdigest()

    folder = os.path.join("maps", map_hash)
    os.makedirs(folder, exist_ok=True)

    if not data.get('regenerate', False) and style.get('style_name', '') != "Custom":
        image = get_map_for_style(folder, style)
        if image:
            return jsonify({
                'image': image,
                'style': style,
            })

    image_data = image_data.replace('data:image/png;base64,', '')
    image_bytes = base64.b64decode(image_data)
    image = Image.open(BytesIO(image_bytes))

    if "started" not in in_progress_generations[identifier]:

        def callback(step=1, timestamp=0, latent=None, place_in_line=0):
            progress = step / generate_images.NUM_STEPS
            in_progress_generations[identifier]["progress"] = progress
            in_progress_generations[identifier]["place_in_line"] = place_in_line

        def work():
            generated_background = generate_images.getBackground(prompt, image, callback=callback)[0]
            uid = uuid.uuid1()
            file_name = f'{folder}/background_image_{uid}.png'
            generated_background.save(file_name)
            with open(f'{folder}/{uid}_style.json', 'w') as f:
                f.write(json.dumps(style))
            with open(f'{folder}/map.json', 'w') as f:
                f.write(json.dumps(map_object))
            in_progress_generations[identifier]["result"] = {
                'image': file_name,
                'style': style,
            }
        thread = threading.Thread(target=work)
        thread.daemon = True
        thread.start()
        in_progress_generations[identifier]["started"] = True
        return jsonify(success=True), 200

    return jsonify(error="Image generation already in progress for this identifier."), 400


@app.route('/poll_save_progress', methods=['POST'])
def poll_save_progress():
    data = request.get_json()
    identifier = data.get('identifier', '')
    if identifier in in_progress_generations:
        if "result" in in_progress_generations[identifier]:
            result = in_progress_generations[identifier]["result"]
            del in_progress_generations[identifier]  # clean up after sending the result
            return jsonify(result)
        elif "progress" in in_progress_generations[identifier]:
            return jsonify({
                "progress": in_progress_generations[identifier]["progress"],
                "place_in_line": in_progress_generations[identifier]["place_in_line"]
            })
    return jsonify(error="Invalid identifier."), 400


@app.route('/create_random_map', methods=['GET'])
def get_random_map():
    new_map = map_creation.generate_random_map()
    return jsonify({
            'map': new_map,
            })
   

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
            thread = threading.Thread(target=map_creation.background_task)
            thread.daemon = True
            thread.start()

    app.run(debug=args.debug, port=args.port)