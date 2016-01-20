import json


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
    content = '<p>' + art.content.replace('\n', '</p><p>') + '</p>'

    html = '<h1>' + art.subject + '</h1>' + '<div class="doc_content">' + content + '</div>'
    return HttpResponse(json.dumps({'html': html}), mimetype='application/json')

def add_annotation(request):
    print "here"
    text = request.REQUEST.get('text');
    place_id = request.REQUEST.get('place_id');
    Annotation.objects.create(text=text, place_id=place_id)
    return HttpResponse(json.dumps({}), mimetype='application/json')
