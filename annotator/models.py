from django.contrib.gis.db import models

import nltk
import pytz

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

    def get_sentences_annotated(self):
        return nltk.sent_tokenize(self.content_with_tag)


class CustomPlace(models.Model):
    shape = models.TextField(null=True, blank=True)
    place_name = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'customplace'
    def toActivity(self):
        return {
            'time': self.created_at,
            'type': 'newplace',
            'shape': self.shape,
            'place_name': self.place_name
        }

class Annotation(models.Model):
    text = models.TextField()
    place_id = models.TextField(null=True, blank=True)
    custom_place = models.ForeignKey(CustomPlace, null=True, blank=True)
    source = models.ForeignKey(Article, null=True, blank=True)
    start = models.IntegerField(null=True, blank=True)
    end = models.IntegerField(null=True, blank=True)
    shape = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    res_code = models.TextField(null=True, blank=True)
    ref_code = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'annotation'
    def toActivity(self):
        place_type = ''
        if self.place_id:
            place_type = 'From Nominatim'
        else:
            place_type = 'Custom'
        return {
            'id': self.id,
            'time': self.created_at,
            'type': 'annotation',
            'source_id': self.source.id,
            'start': self.start,
            'end': self.end,
            'shape': self.shape,
            'search_text': self.text,
            'place_type': place_type,
            'res_code': self.res_code,
            'ref_code': self.ref_code
        }

class SearchLog(models.Model):
    starttime = models.DateTimeField(primary_key=True)
    query = models.TextField()
    ipaddress = models.TextField()
    endtime = models.DateTimeField(null=True, blank=True)
    results = models.IntegerField(null=True, blank=True)
    def toActivity(self):
        tz_time = pytz.timezone('America/New_York').localize(self.starttime).astimezone(pytz.utc)
        return {
            'time': tz_time,
            'type': 'search_local',
            'search_text': self.query,
            'ip': self.ipaddress
        }
    class Meta:
        db_table = 'query_log'
