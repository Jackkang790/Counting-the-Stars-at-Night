"""Prepare one shared RGB image for BOTH NFT and MindAR. Requires Pillow."""
from pathlib import Path
from PIL import Image
import argparse,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--image',required=True);p.add_argument('--out',default='ar-engine/tracking-lab-assets');p.add_argument('--rgb',default='.tmp/nft-tools/building.rgb');p.add_argument('--width-meters',type=float,default=5.6);a=p.parse_args()
if not .1<=a.width_meters<=100:raise ValueError('A measured or explicitly provisional image width is required')
source=Path(a.image);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
image=Image.open(source).convert('RGB');image.thumbnail((960,960));image.save(out/'building.png')
rgb=Path(a.rgb);rgb.parent.mkdir(parents=True,exist_ok=True);rgb.write_bytes(image.tobytes())
meta={'width':image.width,'height':image.height,'widthMeters':a.width_meters,'provisionalDimensions':True,'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'imageSha256':hashlib.sha256((out/'building.png').read_bytes()).hexdigest()}
(out/'target.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');print(json.dumps(meta))
