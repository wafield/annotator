import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'annotator.settings'

from django.conf import settings
from annotator.models import *

articles = Article.objects.all().order_by('id')
for art in articles:
    if 'dup:' in art.article_type:
        print art.id
        if Annotation.objects.filter(source=art).count() == 0:
            print art.id, 'true dup'
            art.article_type = art.article_type.replace('dup', 'hidden')
            art.save()
