# Иконите (192/512/maskable) от снимката test/tmp/icon-src.png
from PIL import Image, ImageDraw
src = Image.open('test/tmp/icon-src.png').convert('RGB')
w, h = src.size
s = min(w, h)
sq = src.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
def rounded(img, r):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], r, fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out
big = sq.resize((512, 512), Image.LANCZOS)
rounded(big, 96).save('public/icon-512.png')
rounded(sq.resize((192, 192), Image.LANCZOS), 36).save('public/icon-192.png')
big.save('public/icon-maskable-512.png')
print('ok')
