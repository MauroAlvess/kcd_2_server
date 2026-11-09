"""Makes the picture that floats above each notice board (user, 2026-11-09: "coloquei dentro de img uma imagem chamada quadro de aviso: ela deve ficar acima de cada quadro de aviso, não pode aparecer por trás de
parede, não pode ter lag, deve ficar perfeitamente acima dos quadros sem perder fps e carregar numa distância boa") as an ASSET THE GAME DRAWS ITSELF: a flat square mesh, a material and a texture, shipped in the
resource's `stream/` folder (the server sends them to every player with the client scripts, `docs/guides/Core concepts/custom-assets.md`) and spawned as a prop over each board (`src/server/board-signs.ts`).
Drawn by the engine, the picture is hidden by walls like any object, never lags behind the camera and costs one quad.

    python tools/make-board-sign.py [--game <KCD2 Data folder>] [--image <png>]

The mesh and the material are COPIES OF THE GAME'S OWN FILES, patched in place (so every chunk keeps the size and the layout the engine's loader already reads): `Objects/special/primitive_plane_noproxy.cgf/.cgfm`
(a plane with no physics proxy) gets four new corners (a 1 m square standing up in the Y/Z plane, its front toward +X, its middle at the origin), a new bounding box and the name of our material;
`Objects/default/editorprimitive_alpha_twosided.mtl` (an alpha-tested, two-sided material) gets our texture. The texture is made the way the game's own are: BC3 (sRGB) in a DX10 DDS with the CryEngine
extension (flags 0x200800 = sRGB), the four smallest mips in the main file and each bigger one in a split file `.dds.1` .. `.dds.4` (as `parchment_e_diff.dds` and its `.1`-`.5` are).

Needs Pillow. Reads the game files from its paks (read only); writes `stream/objects/kcdc/<resource>/quadro_aviso.{cgf,cgfm,mtl}` and `stream/textures/kcdc/<resource>/quadro_aviso_diff.dds{,.1,.2,.3,.4}`.
"""
import argparse
import glob
import io
import os
import struct
import sys
import zipfile

from PIL import Image, ImageFilter

RESOURCE = "kcdc-gamemode"
NAME = "quadro_aviso"
SIDE = 512
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_GAME = r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2\Data"
DEFAULT_IMAGE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(ROOT))), "img", "quadro de aviso.png")

MESH_PATH = f"objects/kcdc/{RESOURCE}/{NAME}"
TEXTURE_PATH = f"textures/kcdc/{RESOURCE}/{NAME}_diff.dds"
HALF = 0.5  # the mesh is a square of one metre: the prop's scale is its size in metres


# ---------------------------------------------------------------------------------------------
# The game's own files

def game_file(data_dir, wanted):
    """The bytes of an entry of the game's paks (zip archives), whatever the case of its path."""
    wanted = wanted.lower()
    for pak in sorted(glob.glob(os.path.join(data_dir, "*Objects*.pak"))):
        with zipfile.ZipFile(pak) as z:
            for info in z.infolist():
                if info.filename.lower() == wanted:
                    return z.read(info)
    raise SystemExit(f"{wanted} is not in the game's paks under {data_dir}")


# ---------------------------------------------------------------------------------------------
# The mesh: the game's plane, patched in place

def chunks_of(data):
    sig, version, count, table = struct.unpack_from("<4sIII", data, 0)
    assert sig == b"CrCh" and version == 0x746, (sig, version)
    out = []
    for n in range(count):
        ctype, cver, cid, size, offset = struct.unpack_from("<HHIII", data, table + 16 * n)
        out.append({"type": ctype, "ver": cver, "id": cid, "size": size, "offset": offset})
    return out


def half(value):
    return struct.pack("<e", value)


def patch_mesh_chunk(body):
    """The bounding box of the Mesh chunk (min and max corners, six floats): the plane's -5..5 square becomes ours."""
    old = struct.pack("<6f", -5, -5, 0, 5, 5, 0)
    assert body.count(old) == 1, "the plane's bounding box is not where it was"
    return body.replace(old, struct.pack("<6f", 0, -HALF, -HALF, 0, HALF, HALF))


def build_mesh(template_cgf, template_cgfm):
    material = MESH_PATH.encode("ascii")
    name = material + b"\x00" * (128 - len(material))
    source = b"kcdc-gamemode tools/make-board-sign.py\x00Mon Nov 09 2026\n\x00kcdc\x00"
    out = []
    for data, is_cgfm in ((template_cgf, False), (template_cgfm, True)):
        buf = bytearray(data)
        for c in chunks_of(data):
            body = bytes(buf[c["offset"]:c["offset"] + c["size"]])
            if c["type"] == 0x1014:  # MtlName: the material's path
                assert body[:31] == b"Objects/default/editorprimitive" or body.startswith(b"Objects/"), body[:40]
                body = name + body[128:]
            elif c["type"] == 0x1013:  # SourceInfo: where the file came from
                body = source + b"\x00" * (c["size"] - len(source))
            elif c["type"] == 0x1000:  # Mesh: the bounding box
                body = patch_mesh_chunk(body)
            elif c["type"] == 0x1017:  # MeshSubsets: the radius of the one subset (half of the square's diagonal)
                words = list(struct.unpack("<14I", body))
                assert words[1] == 1 and words[5] == 6 and words[7] == 4, "not the one-subset plane"
                words[9] = struct.unpack("<I", struct.pack("<f", (2 * HALF * HALF) ** 0.5))[0]
                body = struct.pack("<14I", *words)
            elif c["type"] == 0x1016:  # DataStream
                flags, stype, count, esize, r1, r2 = struct.unpack_from("<6I", body, 0)
                if stype == 15:  # P3S_C4B_T2S: position (4 halves, w = 1), colour, texture coordinates (halves)
                    assert count == 4 and esize == 16
                    corners = [(-HALF, -HALF, 0.0, 1.0), (HALF, -HALF, 1.0, 1.0), (HALF, HALF, 1.0, 0.0), (-HALF, HALF, 0.0, 0.0)]
                    payload = b""
                    for y, z, u, v in corners:
                        payload += half(0.0) + half(y) + half(z) + half(1.0) + b"\xff\xff\xff\xff" + half(u) + half(v)
                    body = body[:24] + payload
                elif stype == 6:  # TANGENTS: tangent (+Y, the way u grows) and bitangent (-Z, the way v grows), each 4 signed shorts, w = -1 as in the game's plane
                    assert count == 4 and esize == 16
                    one = struct.pack("<8h", 0, 32767, 0, -32767, 0, 0, -32767, -32767)
                    body = body[:24] + one * 4
                elif stype == 5:  # INDICES: 0 1 2 2 3 0, as the game's plane has them
                    assert struct.unpack_from("<6H", body, 24) == (0, 1, 2, 2, 3, 0)
                else:
                    raise SystemExit(f"a stream of type {stype} in the template")
            assert len(body) == c["size"], (c, len(body))
            buf[c["offset"]:c["offset"] + c["size"]] = body
        out.append(bytes(buf))
    return out


# ---------------------------------------------------------------------------------------------
# The material

def build_material(template):
    text = template.decode("latin-1").replace("\r\n", "\n")
    assert 'AlphaTest="1"' in text and "Textures/defaults/white_diff.tif" in text, "not the alpha two-sided material"
    text = text.replace('AlphaTest="1"', 'AlphaTest="0.5" Emittance="1,1,1,0.5"')
    text = text.replace('<Texture File="Textures/defaults/white_diff.tif" Map="Diffuse" />', f'<Texture File="{TEXTURE_PATH}" Map="Diffuse" />\n\t\t<Texture File="{TEXTURE_PATH}" Map="Emittance" />')
    return text.replace("\n", "\r\n").encode("ascii")


# ---------------------------------------------------------------------------------------------
# The texture: BC3 sRGB, mips split as the game's

def square_of(image_path):
    """The picture, cropped to what is drawn in it, centred in a square with a little room, SIDE pixels on a side, with the colour of its transparent border bled out."""
    src = Image.open(image_path).convert("RGBA")
    box = src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    crop = src.crop(box)
    side = max(crop.size)
    pad = max(2, round(side * 0.03))
    canvas = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
    canvas.paste(crop, ((canvas.width - crop.width) // 2, (canvas.height - crop.height) // 2))
    return canvas.resize((SIDE, SIDE), Image.LANCZOS)


def bleed(image):
    """Where the picture is transparent, colour the texels with the colours near (so that the filter does not pull a dark fringe in at the edge). The alpha stays."""
    premultiplied = image.convert("RGBa")
    soft = premultiplied.filter(ImageFilter.GaussianBlur(max(2, image.width // 24))).convert("RGBA")
    out = Image.new("RGBA", image.size)
    px, qx, ox = image.load(), soft.load(), out.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a >= 250:
                ox[x, y] = (r, g, b, a)
            else:
                sr, sg, sb, sa = qx[x, y]
                ox[x, y] = ((r, g, b, a) if a > 8 else (sr, sg, sb, a)) if sa > 0 else (r, g, b, a)
    return out


def bc3(image):
    """The BC3 blocks of an image (4 by 4 texels, 16 bytes each, rows of blocks top to bottom), made by Pillow's DDS writer."""
    buffer = io.BytesIO()
    image.save(buffer, format="DDS", pixel_format="DXT5")
    data = buffer.getvalue()
    assert data[:4] == b"DDS " and data[84:88] == b"DXT5", data[84:88]
    blocks = data[128:]
    side = image.width
    assert len(blocks) == (side // 4) * (side // 4) * 16, (len(blocks), side)
    return blocks


def texture_files(image_path):
    base = square_of(image_path)
    levels = []
    side = SIDE
    level = bleed(base)
    while side >= 4:
        if side != SIDE:
            level = bleed(base.resize((side, side), Image.BOX))
        levels.append((side, bc3(level)))
        side //= 2
    # the main file keeps the mips that are 32 texels or less on a side (the game's "persistent" ones), each bigger one is its own file: `.1` the 64, `.2` the 128, ...
    small = [blocks for side_, blocks in levels if side_ <= 32]
    big = [blocks for side_, blocks in reversed(levels) if side_ > 32]
    # the average brightness the game's header keeps (of the picture, where it is drawn)
    total = count = 0
    pix = base.load()
    for y in range(0, SIDE, 4):
        for x in range(0, SIDE, 4):
            r, g, b, a = pix[x, y]
            if a > 128:
                total += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
                count += 1
    average = total / max(1, count)
    header = bytearray()
    header += b"DDS "
    header += struct.pack("<7I", 124, 0x21007, SIDE, SIDE, 0, 0, len(levels))
    one = struct.unpack("<I", struct.pack("<f", 1.0))[0]
    # dwReserved1[11], where CryEngine keeps what it knows of the picture: [1] its flags (0x800 = read as sRGB, 0x200000 as in every texture of the game's), [2] the average brightness, [3..6] the darkest colour, [7..10] the lightest
    header += struct.pack("<11I", 0, 0x200800, struct.unpack("<I", struct.pack("<f", average))[0], 0, 0, 0, 0, one, one, one, one)
    header += struct.pack("<II4sIIIII", 32, 0x4, b"DX10", 0, 0, 0, 0, 0)
    header += struct.pack("<5I", 0x401008, 0, len(small), 0, 0x43525946)
    header += struct.pack("<5I", 78, 3, 0, 1, 0)  # DXGI_FORMAT_BC3_UNORM_SRGB, 2D texture
    assert len(header) == 148, len(header)
    main = bytes(header) + b"".join(small)
    return main, big


# ---------------------------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--game", default=DEFAULT_GAME)
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    args = parser.parse_args()

    cgf, cgfm = build_mesh(game_file(args.game, "Objects/special/primitive_plane_noproxy.cgf"), game_file(args.game, "Objects/special/primitive_plane_noproxy.cgfm"))
    material = build_material(game_file(args.game, "Objects/default/editorprimitive_alpha_twosided.mtl"))
    main_dds, splits = texture_files(args.image)

    objects = os.path.join(ROOT, "stream", "objects", "kcdc", RESOURCE)
    textures = os.path.join(ROOT, "stream", "textures", "kcdc", RESOURCE)
    os.makedirs(objects, exist_ok=True)
    os.makedirs(textures, exist_ok=True)
    files = {
        os.path.join(objects, f"{NAME}.cgf"): cgf,
        os.path.join(objects, f"{NAME}.cgfm"): cgfm,
        os.path.join(objects, f"{NAME}.mtl"): material,
        os.path.join(textures, f"{NAME}_diff.dds"): main_dds,
    }
    for number, blocks in enumerate(splits, start=1):
        files[os.path.join(textures, f"{NAME}_diff.dds.{number}")] = blocks
    for path, data in files.items():
        with open(path, "wb") as handle:
            handle.write(data)
        print(f"{os.path.relpath(path, ROOT)}  {len(data)} bytes")


if __name__ == "__main__":
    sys.exit(main())
