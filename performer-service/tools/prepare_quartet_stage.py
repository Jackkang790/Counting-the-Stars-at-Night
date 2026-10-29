import argparse,json
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('--photo',required=True);p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
image=cv2.imdecode(np.frombuffer(Path(a.photo).read_bytes(),dtype=np.uint8),cv2.IMREAD_COLOR)
if image is None:raise ValueError('Missing supplied room photo')
h,w=image.shape[:2];corners=np.array([[650/1536,410/1152],[1535/1536,50/1152],[1535/1536,980/1152],[622/1536,840/1152]],np.float32)
matrix=cv2.getPerspectiveTransform(corners*np.array([w,h],np.float32),np.array([[0,0],[1599,0],[1599,713],[0,713]],np.float32))
rectified=cv2.warpPerspective(image,matrix,(1600,714));cv2.imwrite(str(out/'facade.jpg'),rectified,[cv2.IMWRITE_JPEG_QUALITY,90])
segments=[{'id':'LandscapeWall','u':[0,.23],'v':[0,1],'kind':'panel'},{'id':'ColumnLeft','u':[.23,.28],'v':[0,1],'kind':'column'},{'id':'LatticeDoor','u':[.28,.86],'v':[0,1],'kind':'door'},{'id':'ColumnRight','u':[.86,.94],'v':[0,1],'kind':'column'},{'id':'RightPanel','u':[.94,1],'v':[0,1],'kind':'panel'}]
(out/'facade.json').write_text(json.dumps({'widthMeters':5.6,'heightMeters':2.5,'provisional':True,'photoCornersNormalized':corners.tolist(),'segments':segments,'note':'Manual perspective rectification and provisional ratios, not measured reconstruction. Opaque facade is preview/calibration only; AR default off.'},indent=2),encoding='utf-8')
