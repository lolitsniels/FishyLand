from rembg import remove, new_session
from PIL import Image, ImageDraw
import glob, os, shutil
s = new_session("isnet-general-use")
os.makedirs('/app/promo_src/icons/old', exist_ok=True)
for f in sorted(glob.glob('*.jpg')):
    n = f[:-4]
    im = remove(Image.open(f).convert('RGB'), session=s)
    im.putalpha(im.split()[-1].point(lambda v: 0 if v < 20 else v)); im = im.crop(im.getbbox())
    if n == 'sail':
        S = 360; out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(out)
        d.ellipse((8, 8, S - 8, S - 8), fill=(12, 74, 140, 255), outline=(255, 255, 255, 255), width=14)
        d.ellipse((34, 34, S - 34, S - 34), fill=(22, 118, 196, 255))
        im.thumbnail((230, 230), Image.LANCZOS); out.alpha_composite(im, ((S - im.width) // 2, (S - im.height) // 2 + 6))
        dst = '/app/frontend/public/art/hud/sail.webp'; shutil.copy(dst, 'old/sail.webp'); out.save(dst, quality=90)
    elif n == 'tackle':
        out = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); im.thumbnail((240, 240), Image.LANCZOS); out.alpha_composite(im, ((256 - im.width) // 2, (256 - im.height) // 2))
        dst = '/app/frontend/public/art/hud/tackle.webp'; shutil.copy(dst, 'old/tackle.webp'); out.save(dst, quality=90)
    else:
        out = Image.new('RGBA', (160, 160), (0, 0, 0, 0)); im.thumbnail((150, 150), Image.LANCZOS); out.alpha_composite(im, ((160 - im.width) // 2, (160 - im.height) // 2))
        dst = f'/app/frontend/public/art/ui/{n}.png'
        if os.path.exists(dst): shutil.copy(dst, f'old/{n}.png')
        out.save(dst, optimize=True)
    print(n, flush=True)
