import json
import re
from HTMLParser import HTMLParser, HTMLParseError


from django.shortcuts import render, render_to_response
from django.http import HttpResponse

from models import *

def home(request):
    context = {}
    context['articles'] = []
    for art in Article.objects.all():
        context['articles'].append({
            'id': art.id,
            'subject': art.subject
        })
    return render(request, 'index.html', context)

def get_doc(request):
    i = request.REQUEST.get('id')
    art = Article.objects.get(id=i)
    content = '<p>' + '</p><p>'.join(art.get_sentences()) + '</p>'
    content = segment_text(content)
    response = {
        'title': art.subject,
        'content': content
    }
    return HttpResponse(json.dumps(response), mimetype='application/json')

def add_annotation(request):
    text = request.REQUEST.get('text')
    place_id = request.REQUEST.get('place_id')
    start = request.REQUEST.get('start')
    end = request.REQUEST.get('end')
    context_id = request.REQUEST.get('context_id')
    source = Article.objects.get(id=context_id)
    geotext = request.REQUEST.get('geotext')
    Annotation.objects.create(text=text, place_id=place_id, start=start, end=end, source=source, shape=geotext)
    return HttpResponse(json.dumps({}), mimetype='application/json')

def load_annotation(request):
    context_id = request.REQUEST.get('context_id')
    annotations = Annotation.objects.filter(source_id=context_id)
    response = {'highlights': []}
    for annotation in annotations:
        response['highlights'].append({
            'id': annotation.id,
            'text': annotation.text,
            'place_id': annotation.place_id,
            'start': annotation.start,
            'end': annotation.end,
            'shape': annotation.shape
        })
    return HttpResponse(json.dumps(response), mimetype='application/json')

def segment_text(content):
    s = Segmenter()
    try:
        s.feed(content)
        return s.get_data()
    except HTMLParseError:
        pass

class Segmenter(HTMLParser):
    def __init__(self):
        self.reset()
        self.fed = []
        self.token_id = 0

    def handle_data(self, d):
        tokens = re.findall(r"[\w'-]+|[.,\\/!?;:\" ]", d)
        for token in tokens:
            self.fed.append('<u class="tk" data-id="' + str(self.token_id) + '">' + token + '</u>')
            self.token_id += 1


    def handle_starttag(self, d, attr):
        tag = ['<', d]
        for a in attr:
            tag.extend([' ', a[0], '="', a[1], '"'])
        tag.append('>')
        self.fed.append(''.join(tag))

    def handle_endtag(self, d):
        self.fed.append('</' + d + '>')

    def handle_startendtag(self, d, attr):
        tag = ['<', d]
        for a in attr:
            tag.extend([' ', a[0], '="', a[1], '"'])
        tag.append(' />')
        self.fed.append(''.join(tag))

    def get_data(self):
        return ''.join(self.fed)