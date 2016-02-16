import os
import re
import datetime
from bs4 import BeautifulSoup

os.environ['DJANGO_SETTINGS_MODULE'] = 'annotator.settings'

from django.conf import settings
from annotator.models import *

base_dir = '/Users/yxt157/Desktop/cdt/'
source = 'cdt'

for fname in os.listdir(base_dir):
	if 'html' not in fname:
		continue
	with open(base_dir + fname, 'r') as f:
		soup = BeautifulSoup(f.read(), 'html.parser')
		url = soup.find('li', 'reddit').a['href'][33:]
		title = soup.body.find('h1', 'title').string.strip()
		created_at = datetime.datetime.strptime('February 3, 2016 8:22 PM', '%B %d, %Y %I:%M %p')
		content = ''
		contents = soup.body.find(id=re.compile('content-body-')).find_all('p')
		for item in contents:
			while item.find('a'):
				item.a.unwrap()
			content += str(item)

		try:
			art = Article.objects.get(subject=title, created_at=created_at)
			art.content = content
			art.content_with_tag = content
			art.subject = title
			art.save()
		except Article.DoesNotExist:
			Article.objects.create(subject=title, content=content, content_with_tag=content, created_at=created_at, article_type='', article_url=url)





