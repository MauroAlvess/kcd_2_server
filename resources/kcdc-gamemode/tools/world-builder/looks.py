"""Top-down looks with a grid at the heart of each place, for choosing where its notice board stands: python looks.py name1 name2 ..."""
import sys
import wbpy

PLACES = {
    "raborsch": (1588, 3822, 100, 60, 10),
    "malesov": (562, 262, 100, 60, 10),
    "wysoka": (390, 2455, 100, 60, 10),
    "kuttenberg": (3109, 752, 120, 70, 10),
    "grunta": (3200, 2250, 100, 60, 10),
    "bylany": (1719, 1067, 100, 60, 10),
    "bohunowitz": (1992, 3438, 100, 60, 10),
    "miskowitz": (1540, 1980, 100, 60, 10),
    "pschitoky": (2307, 1814, 100, 60, 10),
    "stara-kutna": (3070, 1370, 100, 60, 10),
    "horschan": (2577, 2626, 100, 60, 10),
    "stara-lhota": (650, 927, 100, 60, 10),
    "danemark": (1557, 217, 100, 60, 10),
    "rabstein": (980, 1060, 100, 60, 10),
    "opatowitz": (1847, 3005, 100, 60, 10),
    "castelo-suchdol": (775, 3360, 90, 55, 10),
    "castelo-raborsch": (1430, 3840, 90, 55, 10),
    "castelo-malesov": (470, 373, 90, 55, 10),
}

for name in sys.argv[1:]:
    x, y, alt, half, step = PLACES[name]
    try:
        wbpy.look(f"look_{name}.png", x, y, alt, 0, 60, half, step, 4.0)
    except Exception as error:  # keep going: one place failing must not stop the rest
        print(name, "failed:", str(error)[:200])
