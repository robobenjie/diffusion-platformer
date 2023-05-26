import diffusers
import cv2
from PIL import Image
import numpy as np
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
import torch
from diffusers import DPMSolverMultistepScheduler
from diffusers import UniPCMultistepScheduler




PROMPT_TEMPLATE = "Vector art, {user_prompt}, Overdetailed art, (masterpiece:1.2) (illustration:1.2) (best quality:1.2) (cinematic lighting) (sharp focus) (2D)"
NEGATIVE_PROMPT = "lightnings, anime, topless, nsfw, naked, large breast, (dark) (lowpoly) (CG) (bokeh) (3d:1.5) (blurry) (duplicate) (watermark) (label) (signature) (frames) (text), (worst quality:1.2), (low quality:1.2), (normal quality:1.2), lowres, normal quality, ((monochrome)), ((grayscale)) (person)"

controlnet = ControlNetModel.from_pretrained("lllyasviel/sd-controlnet-depth", torch_dtype=torch.float16)
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "./models/childrensIllustration/", controlnet=controlnet, torch_dtype=torch.float16, use_safetensors=True
)#.to("cuda")
pipe.enable_model_cpu_offload()
pipe.enable_xformers_memory_efficient_attention()
#pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

def getBackground(prompt, image):
    seed = np.random.randint(0, 2 ** 32 - 1)
    print("seed", seed)
    full_prompt = PROMPT_TEMPLATE.format(user_prompt=prompt)
    generator = [torch.Generator(device="cpu").manual_seed(seed)]
    output = pipe(
        full_prompt,
        image,
        negative_prompt="monochrome, lowres, bad anatomy, worst quality, low quality",
        num_inference_steps=30,
        generator=generator,
    )
    return output.images
    
