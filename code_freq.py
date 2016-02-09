from django.conf import settings
settings.configure()
from annotator.models import *
# resolution categories
# anno = Annotation.objects.filter(res_code__isnull=False)
# for cat in ['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'C3', 'C4']:
#     print cat, anno.filter(res_code=cat).count()
# anno = Annotation.objects.filter(ref_code__isnull=False)
# for cat in ['L1', 'L2', 'L3', 'L4', 'G1', 'G2', 'G3', 'G4']:
#     print cat, anno.filter(res_code=cat).count()
anno = Annotation.objects.filter(res_code__isnull=False)
for an in anno:
    try:
        print '%s|%s|%s|%s|%s' % (an.text, an.res_code[0], an.res_code[1], an.ref_code[0], an.ref_code[1])
    except:
        pass
