from django.conf.urls import patterns, include, url


import views

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = patterns('',
    url(r'^$', views.home),
    url(r'^doc$', views.get_doc),
    url(r'^new_annotation$', views.new_annotation),
    url(r'^load_annotation$', views.load_annotation),
    url(r'^load_custom_shapes$', views.load_custom_shapes),
)
