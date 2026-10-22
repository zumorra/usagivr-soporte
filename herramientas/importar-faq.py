"""Convierte data/faq_v3.json del paquete UsagiVR_Agentes_Atencion_v3 en src/faq.json (lo que lee el bot).
Uso: python3 -I herramientas/importar-faq.py ruta/faq_v3.json
Deja fuera reemplazos/devoluciones/garantía (eso siempre pasa a un compañero, sin nombrarlo)
y lo específico de eBay Messages, que no aplica en Discord."""
import json, re, sys

FUERA_CAT = {"Garantía y reemplazos", "Garantía, DOA y devoluciones", "Pedidos, cancelaciones y devoluciones", "Canales eBay y soporte"}
FUERA_TXT = re.compile(r"reempla|remplaz|reembols|devoluc|devolver|refund|replacement|return label|\bRMA\b|SOLD AS IS|eBay Messages", re.I)

faq = json.load(open(sys.argv[1], encoding="utf-8"))["faq"]
salida = []
for f in faq:
    if f["category"] in FUERA_CAT or FUERA_TXT.search(" ".join([f["answer_es"], f["answer_en"], f["question_es"], f["question_en"]])):
        continue
    salida.append({
        "id": f["id"], "cat": f["category"],
        "q": {"es": f["question_es"], "en": f["question_en"]},
        "a": {"es": f["answer_es"], "en": f["answer_en"]},
        "alias": f["aliases"]["es"] + f["aliases"]["en"],
    })
json.dump(salida, open("src/faq.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"{len(salida)} de {len(faq)} FAQ importadas")
