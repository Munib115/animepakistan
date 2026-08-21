import os
import sys

def make_icon(size, color, filename):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("PIL not found, installing pillow...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
        from PIL import Image, ImageDraw

    print(f"Creating {size}x{size} icon -> {filename}...")
    img = Image.new('RGBA', (size, size), color)
    draw = ImageDraw.Draw(img)
    
    # Draw a stylized Pakistani-like flag motif: green background with white crescent/star
    # Or just a simple green/white abstract design for now
    if size >= 192:
        # Draw a white circle in the middle
        margin = size // 4
        draw.ellipse([margin, margin, size - margin, size - margin], fill=(255, 255, 255, 255))
        # Draw a green inner circle to make it a crescent
        offset = size // 12
        draw.ellipse([margin + offset, margin, size - margin + offset, size - margin], fill=color)
        # Draw a small star
        star_x = size // 2 + size // 10
        star_y = size // 2 - size // 10
        draw.polygon([
            (star_x, star_y - 12),
            (star_x + 3, star_y - 3),
            (star_x + 12, star_y - 3),
            (star_x + 5, star_y + 3),
            (star_x + 8, star_y + 12),
            (star_x, star_y + 6),
            (star_x - 8, star_y + 12),
            (star_x - 5, star_y + 3),
            (star_x - 12, star_y - 3),
            (star_x - 3, star_y - 3)
        ], fill=(255, 255, 255, 255))

    img.save(filename)
    print(f"Saved {filename}")

if __name__ == '__main__':
    public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    if not os.path.exists(public_dir):
        os.makedirs(public_dir)
        
    pakistan_green = (0, 102, 51, 255) # #006633
    
    make_icon(192, pakistan_green, os.path.join(public_dir, 'icon-192.png'))
    make_icon(192, pakistan_green, os.path.join(public_dir, 'icon-192-maskable.png'))
    make_icon(512, pakistan_green, os.path.join(public_dir, 'icon-512.png'))
    print("PWA Icons created successfully!")
