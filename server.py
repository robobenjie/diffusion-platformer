import os
from flask import Flask, send_from_directory, request
import base64
from PIL import Image
from io import BytesIO


app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return app.send_static_file('index.html')

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/save', methods=['POST'])
def save_image():
    data = request.get_json()
    image_data = data.get('image', '')
    # remove 'data:image/png;base64,' from the start of the data URL
    image_data = image_data.replace('data:image/png;base64,', '')
    # decode the base64 data to bytes
    image_bytes = base64.b64decode(image_data)
    image = Image.open(BytesIO(image_bytes))
    image.save('image.png')
    return 'Image saved', 200
   
@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(port=8000)