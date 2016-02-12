from django.conf.urls import patterns, include, url


import views

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

extrapatterns = patterns('',
    url(r'^$', views.home),
    url(r'^get_doc$', views.get_doc),
    url(r'^new_annotation$', views.new_annotation),
    url(r'^load_annotation$', views.load_annotation),
    url(r'^activities$', views.load_activities),
    url(r'^delete_annotation$', views.delete_annotation),
    url(r'^search_annotation$', views.search_annotation),
    url(r'^change_code$', views.change_code),
    url(r'^update_index$', views.update_index),
)

urlpatterns = extrapatterns + patterns('',
    url(r'^evaluation/', include(extrapatterns))
)
