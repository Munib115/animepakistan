import os
from PIL import Image

src_img = r"C:\Users\Munib Raza\.gemini\antigravity-ide\brain\755b31db-a529-4978-b07c-79bd1e3954ac\anime_pakistan_ap_logo_1787336347972.jpg"
public_dir = r"c:\Users\Munib Raza\OneDrive\Desktop\ANIME URDU\public"
app_dir = r"c:\Users\Munib Raza\OneDrive\Desktop\ANIME URDU\src\app"

img = Image.open(src_img).convert("RGBA")

# 1. Save full logo in public
img.save(os.path.join(public_dir, "logo.png"), "PNG", quality=95)
img.save(os.path.join(public_dir, "logo.webp"), "WEBP", quality=95)

# 2. Save PWA icons
for size in [72, 96, 128, 144, 152, 192, 384, 512]:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(public_dir, f"icon-{size}.png"), "PNG")
    if size in [192, 512]:
        resized.save(os.path.join(public_dir, f"icon-{size}x{size}.png"), "PNG")

# 3. Save Apple Touch Icon
apple_icon = img.resize((180, 180), Image.Resampling.LANCZOS)
apple_icon.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")

# 4. Save Favicon.ico
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
img.save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=ico_sizes)
img.save(os.path.join(app_dir, "favicon.ico"), format="ICO", sizes=ico_sizes)

print("Icons generated successfully!")
