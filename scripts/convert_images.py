import os
import glob
from PIL import Image

def optimize_images(directory="client/src/assets"):
    # Find all jpegs and pngs
    extensions = ['*.jpg', '*.jpeg', '*.png']
    files = []
    for ext in extensions:
        files.extend(glob.glob(os.path.join(directory, '**', ext), recursive=True))
    
    print(f"Found {len(files)} images to optimize.")
    
    for file in files:
        try:
            # We don't overwrite source in case they want to keep original. 
            # We will just generate a .webp version. The user can then update paths if they wish.
            out_path = os.path.splitext(file)[0] + ".webp"
            if not os.path.exists(out_path):
                img = Image.open(file)
                img.save(out_path, 'webp', quality=85)
                print(f"✅ Converted: {os.path.basename(file)} -> .webp")
        except Exception as e:
            print(f"❌ Failed to convert {file}: {e}")

if __name__ == "__main__":
    optimize_images()
