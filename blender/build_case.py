# Boîtier Blu-ray PlayStation (PS3 / PS4 / PS5 partagent le même gabarit).
# Coordonnées « appli » (1 unité = 100 mm, y vers le haut, z vers l'avant) converties en Blender (z vers le haut).
# Usage : Blender -b -P build_case.py -- <dossier de sortie> [--preview]
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = "--preview" in argv
os.makedirs(OUT, exist_ok=True)

W, H, D, T = 1.35, 1.71, 0.15, 0.016
R = 0.035            # rayon des coins
HUB = (0.0, 0.04)    # centre du disque
FLOOR = -D / 2 + T   # fond intérieur du plateau
TOP = D / 2 - T      # haut des parois (le couvercle se pose dessus)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def A(x, y, z):
    """appli -> Blender"""
    return Vector((x, -z, y))


def material(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)
    return m


M_PL = material("Plastic", (0.03, 0.13, 0.62), 0.2)
M_IN = material("Inner", (0.05, 0.17, 0.66), 0.55)

# Cartes faites dans TextureLucraft (tex/outer, tex/inner) : relief (normal) et rugosité (canal G de l'ORM).
TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")


def add_maps(m, folder):
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    base = os.path.join(TEX, folder, "plane_Plane_")
    orm = nt.nodes.new("ShaderNodeTexImage")
    orm.image = bpy.data.images.load(base + "OcclusionRoughnessMetallic.png")
    orm.image.colorspace_settings.name = "Non-Color"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(orm.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nrm = nt.nodes.new("ShaderNodeTexImage")
    nrm.image = bpy.data.images.load(base + "Normal.png")
    nrm.image.colorspace_settings.name = "Non-Color"
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])


if os.path.isdir(TEX):
    add_maps(M_PL, "outer")
    add_maps(M_IN, "inner")


def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, r=0.0, e=0.0, m=M_PL, seg=8):
    """Pavé en coordonnées appli ; r arrondit les 4 arêtes parallèles à z, e adoucit les autres."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = A(x1 if v.co.x > 0 else x0, y1 if v.co.y > 0 else y0, z1 if v.co.z > 0 else z0)
    if r > 0:
        edges = [ed for ed in bm.edges if abs((ed.verts[0].co - ed.verts[1].co).normalized().y) > 0.99]
        bmesh.ops.bevel(bm, geom=edges, offset=r, segments=seg, profile=0.5, affect="EDGES", clamp_overlap=True)
    if e > 0:
        sharp = [ed for ed in bm.edges if ed.is_manifold and ed.calc_face_angle(0) > math.radians(60)]
        bmesh.ops.bevel(bm, geom=sharp, offset=e, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    return new_obj(name, bm, [m])


def cyl(name, cx, cy, z0, z1, r0, r1=None, n=64, m=M_IN):
    """Cylindre (ou tronc de cône) d'axe z appli."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r0, radius2=r1 if r1 is not None else r0, depth=z1 - z0)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    bmesh.ops.translate(bm, verts=bm.verts, vec=A(cx, cy, (z0 + z1) / 2))
    return new_obj(name, bm, [m])


def sector(name, cx, cy, r0, r1, a0, a1, z0, z1, n=24, m=M_IN, z1_in=None):
    """Secteur d'anneau en relief (arcs de maintien, pétales du moyeu). z1_in : hauteur côté intérieur."""
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        c, s = math.cos(a), math.sin(a)
        zi = z1 if z1_in is None else z1_in
        pts = [(r0, z0), (r1, z0), (r1, z1), (r0, zi)]
        rings.append([bm.verts.new(A(cx + rr * c, cy + rr * s, zz)) for rr, zz in pts])
    for i in range(n):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, [m])


def boolean(target, cutter, op="DIFFERENCE"):
    mod = target.modifiers.new("b", "BOOLEAN")
    mod.operation = op
    mod.solver = "EXACT"
    mod.object = cutter
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def join(name, parts):
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts):
        bpy.ops.object.join()
    ob = parts[0]
    ob.name = ob.data.name = name
    return ob


# ------------------------------------------------------------------ Base : demi-coque arrière + tranche
# Comme un vrai boîtier : deux demi-coques peu profondes dont les rebords se rejoignent au milieu
# de l'épaisseur (z = 0), la tranche pleine hauteur côté charnière.
RIM = 0.012          # épaisseur des rebords
MID = 0.0            # plan où les deux rebords se touchent
shell = box("Base", -W / 2, W / 2, -H / 2, H / 2, -D / 2, TOP, r=R, e=0.004, m=M_PL)
cavity = box("cav", -W / 2 + T, W / 2 - RIM, -H / 2 + RIM, H / 2 - RIM, FLOOR, TOP + 0.05, r=R - RIM, e=0.003, m=M_IN)
boolean(shell, cavity)
# au-dessus du plan médian, seule la tranche reste
boolean(shell, box("upper", -W / 2 + T, W / 2 + 0.1, -H / 2 - 0.1, H / 2 + 0.1, MID, TOP + 0.1, m=M_PL))
# double rainure de charnière sur la tranche
for zc in (-D / 2 + 0.03, TOP - 0.028):
    boolean(shell, box("groove", -W / 2 - 0.01, -W / 2 + 0.0022, -H / 2 + 0.03, H / 2 - 0.03, zc - 0.0025, zc + 0.0025, m=M_PL))

parts = [shell]
hx, hy = HUB
parts.append(cyl("platform", hx, hy, FLOOR - 0.001, FLOOR + 0.005, 0.175, 0.17, n=96))
# moyeu : 12 pétales souples autour du bouton, plus hauts vers le centre
for i in range(12):
    a0 = i * math.tau / 12 + 0.06
    a1 = (i + 1) * math.tau / 12 - 0.06
    parts.append(sector(f"petal{i}", hx, hy, 0.078, 0.145, a0, a1, FLOOR + 0.005, FLOOR + 0.009, n=6, z1_in=FLOOR + 0.02))
parts.append(cyl("button", hx, hy, FLOOR + 0.005, FLOOR + 0.03, 0.068, 0.058, n=64))
parts.append(cyl("button_cap", hx, hy, FLOOR + 0.03, FLOOR + 0.034, 0.05, 0.035, n=48))
# cercle de maintien du disque, presque complet (interrompu aux quatre points d'appui des doigts)
for c in (45, 135, 225, 315):
    a = math.radians(c)
    s = math.radians(36)
    parts.append(sector(f"arc{c}", hx, hy, 0.608, 0.62, a - s, a + s, FLOOR - 0.001, FLOOR + 0.012, n=32))
base = join("Base", parts)

# ------------------------------------------------------------------ Couvercle : demi-coque avant (origine sur la charnière)
LZ = -(D / 2 - T / 2)  # z local du plan médian
lid_shell = box("Lid", 0, W, -H / 2, H / 2, LZ, T / 2, r=R, e=0.004, m=M_PL)
boolean(lid_shell, box("lcav", -0.1, W - RIM, -H / 2 + RIM, H / 2 - RIM, LZ - 0.1, -T / 2, r=R - RIM, e=0.003, m=M_IN))
# pas de rebord côté charnière : la tranche de la base est là
boolean(lid_shell, box("lhinge", -0.1, T + 0.002, -H / 2 - 0.1, H / 2 + 0.1, LZ - 0.1, -T / 2, m=M_IN))
lid_parts = [lid_shell]
# attaches à livret : deux cadres rectangulaires côté charnière, en haut et en bas
for sgn in (1, -1):
    yc = sgn * (H / 2 - RIM - 0.17)
    x0, x1, h = 0.05, 0.27, 0.11
    z0, z1 = -T / 2 - 0.014, -T / 2
    lid_parts.append(box("clip_top", x0, x1, yc + h / 2 - 0.012, yc + h / 2, z0, z1, e=0.002, m=M_IN))
    lid_parts.append(box("clip_bot", x0, x1, yc - h / 2, yc - h / 2 + 0.012, z0, z1, e=0.002, m=M_IN))
    lid_parts.append(box("clip_side", x1 - 0.012, x1, yc - h / 2, yc + h / 2, z0, z1, e=0.002, m=M_IN))
    lid_parts.append(box("clip_lip", x1 - 0.05, x1, yc - h / 2, yc + h / 2, z0 - 0.004, z0, e=0.0015, m=M_IN))
lid = join("Lid", lid_parts)
lid.location = A(-W / 2, 0, D / 2 - T / 2)

# ------------------------------------------------------------------ Lissage + UV
for ob in (base, lid):
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(35))
    # UV par projection sur l'axe dominant, en unités réelles (1 UV = 100 mm) : les textures
    # de plastique (grain, quadrillage) se répètent à la même échelle sur toutes les faces.
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            l[uvl].uv = (c.y, c.z) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y)
    bm.to_mesh(ob.data)
    bm.free()

stats = {ob.name: len(ob.data.polygons) for ob in (base, lid)}
print("FACES", stats)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "case.blend"))
for ob in scene.objects:
    ob.select_set(ob in (base, lid))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "case.glb"), export_format="GLB", use_selection=True,
    export_yup=True, export_apply=True, export_materials="EXPORT", export_image_format="JPEG", export_jpeg_quality=88,
)

# ------------------------------------------------------------------ Aperçus (Workbench)
if PREVIEW:
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.show_specular_highlight = True
    scene.render.resolution_x, scene.render.resolution_y = 1100, 900
    scene.render.film_transparent = False
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50

    def shot(fname, eye, target=(0, 0, 0), lid_angle=0.0):
        lid.rotation_euler.z = lid_angle
        cam.location = A(*eye)
        d = A(*target) - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT, fname)
        bpy.ops.render.render(write_still=True)

    shot("prev_open.png", (0.2, 1.4, 3.2), (-0.45, 0, 0), lid_angle=-1.95)
    shot("prev_hub.png", (0.35, 0.65, 1.0), (0, 0.04, -0.06), lid_angle=-1.95)
    shot("prev_closed.png", (-2.6, 1.1, 2.6), lid_angle=0.0)
    lid.rotation_euler.z = 0
