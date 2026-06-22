from PIL import Image

def remove_white_bg(img_path, out_path, threshold=240):
    img = Image.open(img_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if the pixel is close to white
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            # Change to transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(out_path, "PNG")
    print(f"Processed {img_path} -> {out_path}")

try:
    remove_white_bg("etoundi.jpeg", "etoundi_clean.png")
except Exception as e:
    print(f"Failed etoundi: {e}")

try:
    remove_white_bg("maylis.jpeg", "maylis_clean.png")
except Exception as e:
    print(f"Failed maylis: {e}")
