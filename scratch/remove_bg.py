import os
from rembg import remove
from PIL import Image

images = [
    "scroll_fragment.png",
    "knowledge_crystal.png",
    "switch_button.png",
    "door_closed.png",
    "npc_sage.png"
]

for img_name in images:
    if os.path.exists(img_name):
        print(f"Removing background from {img_name}...")
        try:
            input_img = Image.open(img_name)
            output_img = remove(input_img)
            output_img.save(img_name)
            print(f"Success for {img_name}")
        except Exception as e:
            print(f"Failed for {img_name}: {e}")
    else:
        print(f"{img_name} not found")
