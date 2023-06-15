import diffusers
import cv2
import threading
from PIL import Image, ImageOps, ImageEnhance
import numpy as np
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers import StableDiffusionPipeline
from diffusers import StableDiffusionImg2ImgPipeline
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
characterPortraitPipe = None
def createCharacterPipe():
    global characterPipe, characterPortraitPipe
    model_id = "Onodofthenorth/SD_PixelArt_SpriteSheet_Generator"
    characterPipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
    characterPipe.enable_model_cpu_offload()
    characterPipe.enable_xformers_memory_efficient_attention()
    characterPipe.safety_checker = lambda images, clip_input: (images, [False] * len(images))
    characterPortraitPipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "./models/childrensIllustration/", torch_dtype=torch.float16, use_safetensors=True
    )#.to("cuda")
    characterPortraitPipe.enable_model_cpu_offload()
    characterPortraitPipe.enable_xformers_memory_efficient_attention()
    characterPortraitPipe.scheduler = DPMSolverMultistepScheduler.from_config(characterPortraitPipe.scheduler.config)
    characterPortraitPipe.safety_checker = lambda images, clip_input: (images, [False] * len(images))
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
    waiting_on_background_callbacks.insert(0, callback)
    notifyBackgroundCreationQueue()
  
    if callback is None:
        callback = lambda *args, **kwargs: None
    seed = np.random.randint(0, 2 ** 32 - 1)
    full_prompt = PROMPT_TEMPLATE.format(user_prompt=prompt)
    generator = [torch.Generator(device="cpu").manual_seed(seed)]

    with backgroundCreationLock:
        if pipe is None:
            createLevelPipe()
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


def generateCharacters(prompt, num=1, callback=None, callback2=None):
    if callback is None:
        callback = lambda *args, **kwargs: None
    if callback2 is None:
        callback2 = lambda *args, **kwargs: None
    waiting_on_character_callbacks.insert(0, callback)
    notifyCharacterCreationQueue()
    
    sprite_prompt = "PixelartRSS " + prompt

    with characterCreationLock:
        if characterPipe is None:
            createCharacterPipe()
        images = [characterPipe(sprite_prompt, num_inference_steps=CHARACTER_NUM_STEPS, callback=callback).images[0] for _ in range(num)]
    waiting_on_character_callbacks.pop()
    notifyBackgroundCreationQueue()
    names = []

    generator = torch.Generator(device="cpu").manual_seed(55)
    full_prompt = f"bright chibi portrait of {prompt} on white background, Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"
    neg_prompt = "topless, nsfw, naked, (dark) (lowpoly) (CG) (bokeh) (3d:1.5) (blurry) (duplicate) (watermark) (label) (signature) (frames) (text), (worst quality:1.2), (low quality:1.2), (normal quality:1.2), lowres, normal quality, ((monochrome)), ((grayscale))"


    for image in images:
        image = make_white(image, 50)
        if np.random.random() < 0.5:
            crop = image.crop((512 / 4, 512 * .3, 512/2, 512 * 4/5))
        else:
            crop = image.crop((0, 512 * .25, 512/4, 512 * 4/5))
        init_image = make_square_and_resize(crop, 512, estimate_background_color(image))
        portraits = characterPortraitPipe(prompt=full_prompt, negative_prompt=neg_prompt, image=init_image, strength=0.51, guidance_scale=10, generator=generator, callback=callback2)
        portrait = portraits[0][0]
        filter = ImageEnhance.Brightness(portrait)
        portrait = filter.enhance(1.3)
        filter = ImageEnhance.Contrast(portrait)
        portrait = filter.enhance(1.1)
        name= uuid.uuid4()
        names.append(name)
        transparent_edges = make_transparent(image, 50)
        transparent_edges = transparent_edges.resize((100, 100), Image.LANCZOS)
        mirrored_image = ImageOps.mirror(transparent_edges)
        mirrored_image.save(f'./characters/{name}_left.png')
        transparent_edges.save(f"./characters/{name}.png")
        portrait.save(f"./characters/{name}_portrait.png")
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

def make_white(img, tolerance):
    datas = img.getdata()

    # Estimate background color
    background_color = estimate_background_color(img)
    
    newData = []
    for item in datas:
        # change all pixels that are similar to background color to transparent
        if np.all([abs(x - y) < tolerance for x, y in zip(item[:3], background_color)]):
            newData.append((255, 255, 255))
        else:
            newData.append(item)

    img.putdata(newData)
    return img


def make_square_and_resize(img, size, background_color):
    width, height = img.size

    if width == height:
        return img.resize((size, size))

    elif width > height:
        result = Image.new(img.mode, (width, width), background_color)
        result.paste(img, (0, (width - height) // 2))
    else:
        result = Image.new(img.mode, (height, height), background_color)
        result.paste(img, ((height - width) // 2, 0))

    return result.resize((size, size))



