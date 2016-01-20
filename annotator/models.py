from django.contrib.gis.db import models

import datetime, time

class Article(models.Model):
    subject = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    content_with_tag = models.TextField(null=True, blank=True)
    article_type = models.TextField(null=True, blank=True)
    article_url = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'article'

class Annotation(models.Model):
    text = models.TextField()
    place_id = models.TextField()
    source = models.ForeignKey(Article, null=True, blank=True)
    class Meta:
        db_table = 'annotation'
