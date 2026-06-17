from PIL import Image

def crop_labels(img_path):
    img = Image.open(img_path)
    
    # Label regions from vertical profile:
    labels = [
        ("label_0", 13, 37),
        ("label_1", 225, 248),
        ("label_2", 436, 456),
        ("label_3", 642, 665),
        ("label_4", 849, 873)
    ]
    
    for name, sy, ey in labels:
        lbl_img = img.crop((0, sy, img.width, ey))
        lbl_img.save(f"scratch/{name}.png")
        print(f"Saved scratch/{name}.png (Y: {sy}..{ey})")

if __name__ == "__main__":
    crop_labels("mon_sp.jpg")
