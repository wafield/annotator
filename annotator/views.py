import json
import re
from HTMLParser import HTMLParser, HTMLParseError
from django.utils import timezone

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
        'content': content,
        'id': art.id
    }
    return HttpResponse(json.dumps(response), mimetype='application/json')

def new_annotation(request):
    text = request.REQUEST.get('text')
    place_id = request.REQUEST.get('place_id')
    custom_place_id = request.REQUEST.get('custom_place_id') # when adding to a custom place
    start = request.REQUEST.get('start')
    end = request.REQUEST.get('end')
    context_id = request.REQUEST.get('context_id')
    source = Article.objects.get(id=context_id)
    geotext = request.REQUEST.get('geotext') # only when user-drawn
    place_name = request.REQUEST.get('place_name')  # only when user-drawn
    now = timezone.now()

    # adding to custom place
    if custom_place_id:
        place = CustomPlace.objects.get(id=custom_place_id)
        Annotation.objects.create(text=text, custom_place=place, start=start, end=end,
                                  source=source, shape=geotext, created_at=now)
    # creating a new custom place
    elif geotext and place_name and len(geotext) > 0 and len(place_name) > 0:
        newPlace = CustomPlace(shape=geotext, place_name=place_name, created_at=now)
        newPlace.save()
        Annotation.objects.create(text=text, custom_place=newPlace, start=start, end=end,
                                  source=source, shape=geotext, created_at=now)

    # refering to Nominatim place
    else:
        Annotation.objects.create(text=text, place_id=place_id, start=start,
                                  end=end, source=source, shape=geotext, created_at=now)
    return HttpResponse(json.dumps({}), mimetype='application/json')

def load_annotation(request):
    context_id = request.REQUEST.get('context_id')
    annotations = Annotation.objects.filter(source_id=context_id)
    response = {'highlights': []}
    for annotation in annotations:
        annotation_info = {
            'id': annotation.id,
            'text': annotation.text,
            'start': annotation.start,
            'end': annotation.end,
            'shape': annotation.shape
        }
        if annotation.custom_place:
            annotation_info['custom_place_id'] = annotation.custom_place_id
        else:
            annotation_info['place_id'] = annotation.place_id
        response['highlights'].append(annotation_info)
    return HttpResponse(json.dumps(response), mimetype='application/json')

def load_custom_shapes(request):
    response = {'places': []}
    for place in CustomPlace.objects.all().order_by('created_at'):
        response['places'].append({
            'id': place.id,
            'place_name': place.place_name,
            'geotext': place.shape,
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