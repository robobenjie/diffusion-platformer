import diffusers
import cv2
import threading
from PIL import Image, ImageOps
import numpy as np
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers import StableDiffusionPipeline
import torch
from diffusers import DPMSolverMultistepScheduler
import uuid

NUM_STEPS = 10
CHARACTER_NUM_STEPS = 25


PROMPT_TEMPLATE = "Vector art, {user_prompt}, Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"
NEGATIVE_PROMPT = "lightnings, anime, topless, nsfw, naked, large breast, (dark) (lowpoly) (CG) (bokeh) (3d:1.5) (blurry) (duplicate) (watermark) (label) (signature) (frames) (text), (worst quality:1.2), (low quality:1.2), (normal quality:1.2), lowres, normal quality, ((monochrome)), ((grayscale)) (person)"
ITEM_PROMPT_TEMPLATE = "spritesheet, floating {user_prompt} on white background, videogame item 2D, vector art,  Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"

backgroundCreationLock = threading.Lock()
waiting_on_background_callbacks = []

characterCreationLock = threading.Lock()
waiting_on_character_callbacks = []

pipe = None
def createLevelPipe():
    global pipe
    controlnet = ControlNetModel.from_pretrained("lllyasviel/sd-controlnet-depth", torch_dtype=torch.float16)
    pipe = StableDiffusionControlNetPipeline.from_pretrained(
        "./models/childrensIllustration/", controlnet=controlnet, torch_dtype=torch.float16, use_safetensors=True
    )#.to("cuda")
    pipe.enable_model_cpu_offload()
    pipe.enable_xformers_memory_efficient_attention()
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)


characterPipe = None
def createCharacterPipe():
    global characterPipe
    model_id = "Onodofthenorth/SD_PixelArt_SpriteSheet_Generator"
    characterPipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
    characterPipe.enable_model_cpu_offload()
    characterPipe.enable_xformers_memory_efficient_attention()
    characterPipe.safety_checker = lambda images, clip_input: (images, [False] * len(images))
    #characterPipe = characterPipe.to("cuda")

def notifyBackgroundCreationQueue():
    total = len(waiting_on_background_callbacks)
    for i, callback in enumerate(waiting_on_background_callbacks):
        callback(place_in_line=total - i)

def notifyCharacterCreationQueue():
    total = len(waiting_on_character_callbacks)
    for i, callback in enumerate(waiting_on_character_callbacks):
        callback(place_in_line=total - i)

def getBackground(prompt, image, callback=None, num_steps=NUM_STEPS):
    if pipe is None:
        createLevelPipe()
    if callback is None:
        callback = lambda *args, **kwargs: None
    seed = np.random.randint(0, 2 ** 32 - 1)
    full_prompt = PROMPT_TEMPLATE.format(user_prompt=prompt)
    generator = [torch.Generator(device="cpu").manual_seed(seed)]
    waiting_on_background_callbacks.insert(0, callback)
    notifyBackgroundCreationQueue()
    with backgroundCreationLock:
        try:
            output = pipe(
                full_prompt,
                image,
                negative_prompt="monochrome, lowres, bad anatomy, worst quality, low quality, (watermark) (label) (signature) (frames) (text)",
                num_inference_steps=num_steps,
                generator=generator,
                callback=callback,
            )
        finally:
            waiting_on_background_callbacks.pop()
            notifyBackgroundCreationQueue()
    return output.images


def generateCharacters(prompt, num=1, callback=None):
    waiting_on_character_callbacks.insert(0, callback)
    notifyCharacterCreationQueue()
    if characterPipe is None:
        createCharacterPipe()
    
    prompt = prompt + " PixelartRSS"

    with characterCreationLock:
      images = [characterPipe(prompt, num_inference_steps=CHARACTER_NUM_STEPS, callback=callback).images[0] for _ in range(num)]
    waiting_on_character_callbacks.pop()
    notifyBackgroundCreationQueue()
    names = []
    for image in images:
        name= uuid.uuid4()
        names.append(name)
        transparent_edges = make_transparent(image, 50)
        transparent_edges = transparent_edges.resize((100, 100), Image.LANCZOS)
        mirrored_image = ImageOps.mirror(transparent_edges)
        mirrored_image.save(f'./characters/{name}_left.png')
        transparent_edges.save(f"./characters/{name}.png")
    return names


def getCollectable(callback=None):
    seed = np.random.randint(0, 2 ** 32 - 1)
    full_prompt = ITEM_PROMPT_TEMPLATE.format(user_prompt=prompt)
    generator = [torch.Generator(device="cpu").manual_seed(seed)]
    #TODO: generate: 256x256, make transparent and downscale.

def estimate_background_color(img):
    # Get image data
    data = np.array(img)
    
    # Get edge pixel data
    edges = np.concatenate([data[0], data[-1], data[:, 0], data[:, -1]])
    
    # Calculate the average color of the edges
    background_color = tuple(np.average(edges, axis=0).astype(int))
    
    return background_color

def make_transparent(img, tolerance):
    img = img.convert("RGBA")
    datas = img.getdata()

    # Estimate background color
    background_color = estimate_background_color(img)
    
    newData = []
    for item in datas:
        # change all pixels that are similar to background color to transparent
        if np.all([abs(x - y) < tolerance for x, y in zip(item[:3], background_color)]):
            newData.append((background_color[0], background_color[1], background_color[2], 0))
        else:
            newData.append(item)

    img.putdata(newData)
    return img


