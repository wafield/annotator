import json
import re
import time
from HTMLParser import HTMLParser, HTMLParseError
from django.utils import timezone

from django.shortcuts import render, render_to_response
from django.http import HttpResponse
from django.template.loader import render_to_string

from models import *

def home(request):
    context = {}
    context['articles'] = []
    for art in Article.objects.filter(article_type='Local News').order_by('id'):
        if art.created_at:
            date = art.created_at.strftime('%m/%d/%Y')
        else:
            date = 'Unknown date'
        context['articles'].append({
            'id': art.id,
            'subject': art.subject,
            'date': date
        })
    return render(request, 'index.html', context)

def get_doc(request):
    i = request.REQUEST.get('id')
    art = Article.objects.get(id=i)
    content = '<p>' + '</p><p>'.join(art.get_sentences_annotated()) + '</p>'
    content = segment_text(content)
    if art.created_at:
        date = art.created_at.strftime('%m/%d/%Y')
    else:
        date = 'Unknown date'
    response = {
        'title': art.subject,
        'content': content,
        'id': art.id,
        'date': date
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

def search_annotation(request):
    searchText = request.REQUEST.get('text')
    anno_matches = Annotation.objects.filter(text__iexact=searchText, place_id__isnull=False)
    custom_matches = CustomPlace.objects.filter(place_name__iexact=searchText)
    results_anno = []
    results_cp = []
    for anno in anno_matches:
        results_anno.append({
            'place_id': anno.place_id,
            'shape': anno.shape,
            'name': anno.text
        })
    for cp in custom_matches:
        results_cp.append({
            'cp_id': cp.id,
            'shape': cp.shape,
            'name': cp.place_name
        })
    return HttpResponse(json.dumps({
        'annotation_matches': results_anno,
        'customplace_matches': results_cp
    }), mimetype='application/json')

def load_activities(request):
    annotations = Annotation.objects.all()
    #newshape = CustomPlace.objects.all()
    #searchlog = SearchLog.objects.exclude(ipaddress='130.203.151.199').exclude(query='')
    activities = []
    activities += [item.toActivity() for item in annotations]
    #activities += [item.toActivity() for item in newshape]
    #lastitem = {'query': '', 'ip': ''}
    #for item in searchlog:
    #    if item.query == lastitem['query'] and item.ipaddress == lastitem['ip']:
    #        continue
    #    lastitem = {'query': item.query, 'ip': item.ipaddress}
    #    activities.append(item.toActivity())
    activities = sorted(activities, key=lambda x:x['time'], reverse=True)
    return HttpResponse(json.dumps({
        'html': render_to_string("activities.html", {'activities': activities})
    }), mimetype='application/json')

def delete_annotation(request):
    id = request.REQUEST.get('id')
    Annotation.objects.get(id=id).delete()
    return HttpResponse(json.dumps({}), mimetype='application/json')

def change_code(request):
    id = request.REQUEST.get('id')
    code_type = request.REQUEST.get('code_type')
    code = request.REQUEST.get('code')
    annotation = Annotation.objects.get(id=id)
    if code_type == 'resolve':
        annotation.res_code = code
        annotation.save()
    elif code_type == 'reference':
        annotation.ref_code = code
        annotation.save()
    return HttpResponse(json.dumps({}), mimetype='application/json')

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
        if d == 'span':
            self.fed.append('<span class="geotag">')
        else:
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
