from PIL import Image

def crop_frames(img_path):
    img = Image.open(img_path)
    
    # Bounding box measurements:
    # Frame 0: X=72, w=125
    # Frame 5: X=820, w=125
    # Row 3: Y=667, h=160
    # Row 4: Y=880, h=160
    
    # Jump Frame 0 (Rising)
    jump_f0 = img.crop((72, 667, 72+125, 667+160))
    jump_f0.save("scratch/jump_frame_0.png")
    
    # Jump Frame 5 (Falling)
    jump_f5 = img.crop((820, 667, 820+125, 667+160))
    jump_f5.save("scratch/jump_frame_5.png")
    
    # Victory Frame 0
    vic_f0 = img.crop((72, 880, 72+125, 880+160))
    vic_f0.save("scratch/victory_frame_0.png")
    
    print("Saved jump_frame_0.png, jump_frame_5.png, and victory_frame_0.png to scratch/ for verification.")

if __name__ == "__main__":
    crop_frames("mon_sp_clean.png")
