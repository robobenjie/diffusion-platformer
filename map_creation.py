import json
import os
import random
import numpy as np
import uuid
import generate_images
from collections import defaultdict




def generate_random_map():
    width = 25
    jump_prob = 0.5
    maps = []
    folder = 'maps/'

    # Traverse directory with all files
    for root, dirs, files in os.walk(folder):
        for file in files:
            # Check for .json extension
            if file == 'map.json':
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
    return list(zip(*new_map_t))

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