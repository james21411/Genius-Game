import os
from rembg import remove
from PIL import Image

images = [
    ("etoundi.jpeg", "etoundi_clean.png"),
    ("maylis.jpeg", "maylis_clean.png")
]

for in_name, out_name in images:
    if os.path.exists(in_name):
        print(f"Removing background from {in_name}...")
        try:
            input_img = Image.open(in_name)
            output_img = remove(input_img)
            output_img.save(out_name)
            print(f"Success for {in_name} -> {out_name}")
        except Exception as e:
            print(f"Failed for {in_name}: {e}")
    else:
        print(f"{in_name} not found")
