# Genera colocacion-7/9/11.png a partir de los dibujos del manual, agregando el tracker de cintura.
# Uso (desde la raiz del repo): python3 herramientas/diagramas-cintura.py
from PIL import Image, ImageDraw, ImageFont
import sys
A='assets/'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
BG=(61,64,62)
def texto(im, s, xy, size, condensar=0.78):
    f=ImageFont.truetype(FONT,size)
    l,t,r,b=f.getbbox(s)
    capa=Image.new('RGBA',(r+8,b+8),(0,0,0,0))
    ImageDraw.Draw(capa).text((2-l,2),s,font=f,fill='white',stroke_width=2,stroke_fill='white')
    capa=capa.resize((int(capa.width*condensar),capa.height),Image.LANCZOS)
    im.paste(capa,xy,capa); return capa.size
def flecha(d,x0,y0,x1,y1,col):
    d.line((x0,y0,x1,y1),fill=col,width=4)
    import math
    a=math.atan2(y1-y0,x1-x0)
    for s in (2.6,-2.6):
        d.line((x1,y1,x1+14*math.cos(a+s),y1+14*math.sin(a+s)),fill=col,width=4)
def hacer(base, sale, hip_box, cintura_y, titulo, lado='izq', col=(190,110,230)):
    im=Image.open(A+base).convert('RGB')
    x0,y0,x1,y1=hip_box
    pieza=im.crop((x0-3,y0-3,x1+4,y1+4))
    cx=(x0+x1)//2
    d=ImageDraw.Draw(im)
    im.paste(pieza,(cx-pieza.width//2,cintura_y-pieza.height//2))
    # titulo
    top=next(y for y in range(100,200) if sum(im.getpixel((200,y)))<250)
    left=next(x for x in range(0,120) if sum(im.getpixel((x,300)))<250)
    d.rectangle((left+2,top+2,340,265),fill=BG)
    texto(im,titulo[0],(60,138),62); texto(im,'TRACKERS',(60,198),62)
    if lado=='izq':
        w,h=texto(im,'WAIST',(150,cintura_y-26),44)
        flecha(d,150+w+6,cintura_y,cx-pieza.width//2-6,cintura_y,col)
    else:
        w,h=texto(im,'WAIST',(640,cintura_y-26),44)
        flecha(d,634,cintura_y,cx+pieza.width//2+6,cintura_y,col)
    im.save(A+sale,optimize=True)
hacer('colocacion-5mas1.png','colocacion-7.png',(443,603,460,632),566,['5+2'])
hacer('colocacion-5mas3.png','colocacion-9.png',(442,627,467,658),592,['5+4'])
hacer('colocacion-7mas3.png','colocacion-11.png',(454,600,478,629),566,['7+4'],lado='der')
