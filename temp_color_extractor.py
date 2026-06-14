import struct
import zlib
from collections import Counter

path = 'assets/market4u.png'
with open(path, 'rb') as f:
    data = f.read()

if data[:8] != b'\x89PNG\r\n\x1a\n':
    raise SystemExit('not png')

pos = 8
chunks = []
while pos < len(data):
    length = struct.unpack('>I', data[pos:pos+4])[0]
    typ = data[pos+4:pos+8].decode('ascii')
    chunk = data[pos+8:pos+8+length]
    chunks.append((typ, chunk))
    pos += length + 12
    if typ == 'IEND':
        break

ihdr = dict(zip(
    ['width', 'height', 'bit', 'color', 'compression', 'filter', 'interlace'],
    struct.unpack('>IIBBBBB', chunks[0][1])
))
print(ihdr)

idat = b''.join(chunk for typ, chunk in chunks if typ == 'IDAT')
raw = zlib.decompress(idat)
w, h = ihdr['width'], ihdr['height']
assert ihdr['interlace'] == 0
assert ihdr['color'] == 6
bpp = 4
prev_row = None
arr = []
for y in range(h):
    rowstart = y * (w * bpp + 1)
    filter_type = raw[rowstart]
    row = bytearray(raw[rowstart+1:rowstart+1+w*bpp])
    if filter_type == 0:
        pass
    elif filter_type == 1:
        for i in range(bpp, len(row)):
            row[i] = (row[i] + row[i-bpp]) % 256
    elif filter_type == 2:
        for i in range(len(row)):
            row[i] = (row[i] + (prev_row[i] if prev_row else 0)) % 256
    elif filter_type == 3:
        for i in range(len(row)):
            left = row[i-bpp] if i >= bpp else 0
            up = prev_row[i] if prev_row else 0
            row[i] = (row[i] + ((left + up) // 2)) % 256
    elif filter_type == 4:
        for i in range(len(row)):
            left = row[i-bpp] if i >= bpp else 0
            up = prev_row[i] if prev_row else 0
            upleft = prev_row[i-bpp] if (prev_row and i >= bpp) else 0
            pa = left
            pb = up
            pc = upleft
            p = pa + pb - pc
            pa = abs(p - pa)
            pb = abs(p - pb)
            pc = abs(p - pc)
            row[i] = (row[i] + (pa if pa <= pb and pa <= pc else pb if pb <= pc else pc)) % 256
    else:
        raise SystemExit('unsupported filter')

    for x in range(w):
        i = x * 4
        r, g, b, a = row[i], row[i+1], row[i+2], row[i+3]
        if a > 0:
            arr.append((r, g, b))
    prev_row = row

avg = [int(round(sum(c) / len(arr))) for c in zip(*arr)]
print('avg', avg)
cnt = Counter(arr)
print('top', cnt.most_common(10))
