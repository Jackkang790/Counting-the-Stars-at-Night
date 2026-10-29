"""Controlled target/blank stimulus for browser tests, NEVER physical AR evidence."""
from pathlib import Path
from PIL import Image
import numpy as np
folder=Path('.tmp/nft-tools');folder.mkdir(parents=True,exist_ok=True)
image=Image.open('ar-engine/tracking-lab-assets/building.png').convert('RGB');image.thumbnail((540,400))
frame=Image.new('RGB',(640,480),(218,218,218));frame.paste(image,((640-image.width)//2,(480-image.height)//2))
def yuv(im):
    rgb=np.asarray(im,dtype=np.float64);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    y=np.clip(16+.257*r+.504*g+.098*b,16,235).astype('uint8')
    u=np.clip(128-.148*r-.291*g+.439*b,16,240);v=np.clip(128+.439*r-.368*g-.071*b,16,240)
    def down(a):return a.reshape(240,2,320,2).mean(axis=(1,3)).astype('uint8')
    return y.tobytes()+down(u).tobytes()+down(v).tobytes()
target=yuv(frame);empty=yuv(Image.new('RGB',(640,480),(218,218,218)))
with (folder/'camera.y4m').open('wb') as f:
    f.write(b'YUV4MPEG2 W640 H480 F12:1 Ip A1:1 C420jpeg\n')
    for i in range(20*12):f.write(b'FRAME\n'+(target if 24<=i<108 or 144<=i else empty))
print('Synthetic video generated: 2s blank, 7s target, 3s blank, 8s target. Not phone AR evidence.')
