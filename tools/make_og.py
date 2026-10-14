#!/usr/bin/env python3
"""Render og.png (1200x630) and icon-180.png for Math Survival with Pillow only."""
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..')
def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
BG=(244,245,247); INK=(21,24,31); MUTED=(107,114,128); GREEN=(34,197,94); GREEN_D=(22,163,74); RED=(239,68,68); LINE=(227,230,235); WHITE=(255,255,255)
W,H=1200,630
img=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(img)
# Left: title + tagline + rules
d.text((70,120),'MATH',font=font(118),fill=INK)
d.text((70,230),'SURVIVAL',font=font(118),fill=INK)
d.rounded_rectangle([72,362,172,374],radius=6,fill=GREEN)
d.text((72,398),'Solve. Survive. Beat your best.',font=font(34),fill=MUTED)
y=470
for k,v,c in [('Correct','+2s',GREEN_D),('5 in a row','+10s',GREEN_D),('Skip','-5s',RED)]:
    d.text((72,y),k,font=font(24),fill=MUTED); d.text((250,y),v,font=font(24),fill=c); y+=38
# Right: phone card with a problem and keypad
px,py,pw,ph=760,48,370,534
d.rounded_rectangle([px+10,py+14,px+pw+10,py+ph+14],radius=36,fill=(220,223,228))
d.rounded_rectangle([px,py,px+pw,py+ph],radius=36,fill=WHITE,outline=LINE,width=3)
d.text((px+pw//2,py+58),'27.3',font=font(56),fill=INK,anchor='mm')
for i in range(5):
    cx=px+pw//2-60+i*30
    d.ellipse([cx-8,py+102,cx+8,py+118],fill=GREEN if i<3 else (215,219,226))
d.text((px+pw//2,py+178),'27 + 38',font=font(58),fill=INK,anchor='mm')
d.line([px+90,py+266,px+pw-90,py+266],fill=INK,width=4)
d.text((px+pw//2,py+240),'6',font=font(44),fill=INK,anchor='mm')
keys=['7','8','9','4','5','6','1','2','3']
kw,kh,gap=100,50,10; kx0=px+(pw-(3*kw+2*gap))//2; ky0=py+286
for i,k in enumerate(keys):
    r,c=divmod(i,3); x=kx0+c*(kw+gap); yy=ky0+r*(kh+gap)
    d.rounded_rectangle([x,yy,x+kw,yy+kh],radius=14,fill=(248,249,251),outline=LINE,width=2)
    d.text((x+kw//2,yy+kh//2),k,font=font(28),fill=INK,anchor='mm')
yy=ky0+3*(kh+gap)
d.rounded_rectangle([kx0,yy,kx0+3*kw+2*gap,yy+kh],radius=14,fill=GREEN)
d.text((kx0+(3*kw+2*gap)//2,yy+kh//2),'SUBMIT',font=font(26),fill=WHITE,anchor='mm')
d.text((72,586),'pippopoppi.github.io/math-survival  -  Pippo Poppi Games',font=font(22),fill=MUTED)
img.save(os.path.join(OUT,'og.png'),optimize=True)
# icon 180
ic=Image.new('RGB',(180,180),BG); dd=ImageDraw.Draw(ic)
dd.rounded_rectangle([14,14,166,166],radius=32,fill=WHITE,outline=LINE,width=4)
dd.text((90,86),'8+7',font=font(64),fill=INK,anchor='mm')
dd.rounded_rectangle([50,128,130,142],radius=7,fill=GREEN)
ic.save(os.path.join(OUT,'icon-180.png'),optimize=True)
print('ok')
