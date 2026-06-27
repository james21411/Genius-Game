from PIL import Image

def process_character(img_path, out_path, target_size=(960, 1072), threshold=200):
    try:
        # Load and resize image exactly to target_size to fix the frame coordinates issue
        img = Image.open(img_path).convert("RGBA")
        img = img.resize(target_size, Image.Resampling.LANCZOS)
        
        data = img.getdata()
        new_data = []
        
        # Remove white/light background
        for item in data:
            # item is (R, G, B, A)
            if item[0] > threshold and item[1] > threshold and item[2] > threshold:
                new_data.append((255, 255, 255, 0)) # transparent
            else:
                # To prevent gray borders, maybe we shouldn't touch non-background pixels, but
                # if there is a dark rectangle, it might mean the alpha was not 0.
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(out_path, "PNG")
        print(f"Processed {img_path} -> {out_path} at size {target_size}")
    except Exception as e:
        print(f"Error processing {img_path}: {e}")

process_character("etoundi.jpeg", "etoundi_clean.png")
process_character("maylis.jpeg", "maylis_clean.png")
process_character("mon_sp.jpg", "mon_sp_clean.png") # Let's also re-process the original if needed, no wait, mon_sp_clean.png is already good.
