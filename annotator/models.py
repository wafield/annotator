from django.contrib.gis.db import models

import nltk

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

    def get_sentences(self):
        return nltk.sent_tokenize(self.content)


class CustomPlace(models.Model):
    shape = models.TextField(null=True, blank=True)
    place_name = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'customplace'

class Annotation(models.Model):
    text = models.TextField()
    place_id = models.TextField(null=True, blank=True)
    custom_place = models.ForeignKey(CustomPlace, null=True, blank=True)
    source = models.ForeignKey(Article, null=True, blank=True)
    start = models.IntegerField(null=True, blank=True)
    end = models.IntegerField(null=True, blank=True)
    shape = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'annotation'

