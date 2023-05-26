import diffusers
import cv2
from PIL import Image, ImageOps
import numpy as np
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers import StableDiffusionPipeline
import torch
from diffusers import DPMSolverMultistepScheduler
import uuid

NUM_STEPS = 30
CHARACTER_NUM_STEPS = 20


PROMPT_TEMPLATE = "Vector art, {user_prompt}, Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"
NEGATIVE_PROMPT = "lightnings, anime, topless, nsfw, naked, large breast, (dark) (lowpoly) (CG) (bokeh) (3d:1.5) (blurry) (duplicate) (watermark) (label) (signature) (frames) (text), (worst quality:1.2), (low quality:1.2), (normal quality:1.2), lowres, normal quality, ((monochrome)), ((grayscale)) (person)"
ITEM_PROMPT_TEMPLATE = "spritesheet, floating {user_prompt} on white background, videogame item 2D, vector art,  Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"

controlnet = ControlNetModel.from_pretrained("lllyasviel/sd-controlnet-depth", torch_dtype=torch.float16)
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "./models/childrensIllustration/", controlnet=controlnet, torch_dtype=torch.float16, use_safetensors=True
)#.to("cuda")


model_id = "Onodofthenorth/SD_PixelArt_SpriteSheet_Generator"
characterPipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
characterPipe.enable_model_cpu_offload()
characterPipe.enable_xformers_memory_efficient_attention()
characterPipe.safety_checker = lambda images, clip_input: (images, [False] * len(images))
#characterPipe = characterPipe.to("cuda")

pipe.enable_model_cpu_offload()
pipe.enable_xformers_memory_efficient_attention()
#pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

def getBackground(prompt, image, callback=None):
    seed = np.random.randint(0, 2 ** 32 - 1)
    print("seed", seed)
    full_prompt = PROMPT_TEMPLATE.format(user_prompt=prompt)
    generator = [torch.Generator(device="cpu").manual_seed(seed)]
    output = pipe(
        full_prompt,
        image,
        negative_prompt="monochrome, lowres, bad anatomy, worst quality, low quality",
        num_inference_steps=NUM_STEPS,
        generator=generator,
        callback=callback,
    )
    return output.images


def generateCharacter(prompt, callback=None):
    name= uuid.uuid4()
    prompt = prompt + " PixelartRSS"
    image = characterPipe(prompt, num_inference_steps=CHARACTER_NUM_STEPS, callback=callback).images[0]
    transparent_edges = make_transparent(image, 50)
    transparent_edges = transparent_edges.resize((100, 100), Image.LANCZOS)
    mirrored_image = ImageOps.mirror(transparent_edges)
    mirrored_image.save(f'./characters/{name}_left.png')
    transparent_edges.save(f"./characters/{name}.png")
    return name


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


