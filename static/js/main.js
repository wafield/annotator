$(document).ready(function() {

    window.highlightText = {};
    window.newHighlight = {};
    window.highlightsData = {};
    window.isDragging = false;

    window.customShapes = {};

    window.map = null;
	window.sortBy = 'ontology';
	window.urlPrefix = '/evaluation/';
    initmap();

    initAnnotationControls();

	$('#article_dropdown').dropdown();
    $('body').on('click', '#show_article_list', function() {
        $('.ui.sidebar')
            .sidebar('setting', 'dimPage', 'false')
            .sidebar('toggle');
    });
    $('body').on('click', '#show_activities', function() {
        $('#doc_content').css('height', '50%');
        $(this).text('loading...');
        $('#activities').show()
            .html('<div class="ui active centered inline loader"></div>');
        $.ajax({
            url: window.urlPrefix + 'activities',
            success: function(xhr) {
                $('#show_activities').text('Refresh activities');
                $('#activities').html(xhr.html);
                window.activityTable = $('#activity_table').DataTable({
                    'ordering': false,
                    'scrollY': $('#activities').height() - 80,
                    'columns': [
                        null,
                        {'searchable': false},
                        null,
                        {'searchable': false},
                        {'searchable': false},
                        {'searchable': false}
                    ]
                });
            }
        })
    }).on('click', '.show_shape', function() {
        var geotext = this.getAttribute('data-geotext');
        showDetail(geotext);
    }).on('click', '.annotation_src', function() {
        var id = this.getAttribute('data-source-id');
        var start = this.getAttribute('data-start');
        var end = this.getAttribute('data-end');
        if (id == $('#doc_content').attr('data-article-id')) {
            highlightAndJump({
                start: start,
                end: end
            });
        } else {
            loadDocument(id).done(function() {
                highlightAndJump({
                    start: start,
                    end: end
                });
            });
        }
    }).on('click', '.delete_annotation', function() {
        var id = this.getAttribute('data-id');
        var that = this;
        $.ajax({
            url: window.urlPrefix + 'delete_annotation',
            type: 'post',
            data: {id: id},
            success: function() {
                window.activityTable
                    .row($(that).parents('tr'))
                    .remove()
                    .draw(false);
            }
        })
    }).on('click', '#rebuild_index', function() {
		$('body').off('click', '#rebuild_index');
		$.ajax(window.urlPrefix + 'update_index');
	});
    $('#activities').on('change', '.resolve_code', function() {
        var that = this;
        $.ajax({
            url: window.urlPrefix + 'change_code',
            data: {
                'id': that.getAttribute('data-id'),
                'code': $(that).find(':selected').val(),
                'code_type': 'resolve'
            },
            type: 'post'
        }) ;
    }).on('change', '.reference_code', function() {
        var that = this;
        $.ajax({
            url: window.urlPrefix + 'change_code',
            data: {
                'id': that.getAttribute('data-id'),
                'code': $(that).find(':selected').val(),
                'code_type': 'reference'
            },
            type: 'post'
        });
    });
    $('body').on('click', '.article.title', function() {
        var id = this.getAttribute('data-id');
        loadDocument(id);
    });
    $('body').on('click', '.searchandrank', function(e) {
        e.preventDefault();
		window.strategy = this.getAttribute('data-method');
		window.ajaxRemaining = 2;
		$('#search_results').html('Searching ...');
        var searchtext = $('#search_text').val();
		searchInPrevious(searchtext);
		searchLocal(searchtext, function() {
			window.ajaxRemaining --;
			if (window.ajaxRemaining <= 0) {
				searchCallback();
			}
		});
    }).on('click', '#search_global', function(e) {
        e.preventDefault();
		var text = $('#search_text').val();
		searchGlobal(text);
    }).on('click', '.sort_by', function() {
		window.sortBy = this.getAttribute('data-sort');
		$('#search_nominatim').trigger('click');
	});

    $('#save_shape').click(function() {
        if (Object.keys(window.newHighlight).length == 0) {
            alert('Error. Did you highlight any text?');
            return;
        }
        var feature = window.drawSource.getFeatures();
        if (feature.length != 1) {
            alert('There should be exactly 1 shape on the map.');
            return;
        }

        var text = $('#search_text').val();
        var place_name = window.prompt('Please input the name of this place', text);
        if (place_name == null) {
            return; // do nothing more; allow user to redraw
        }
        if (place_name.length == 0) {
            alert('Place name should not be empty.');
            return;
        }
        var confirmtext = "Save the following annotation?" +
            "\nAnnotated text: " + $('#search_text').val() +
            "\nPlace name: " + place_name +
            "\nShape: (the line/polygon you drew)."
        var dosave = window.confirm(confirmtext);
        if (dosave == false) return;

        feature[0].getGeometry().transform('EPSG:3857', 'EPSG:4326');

        var start = window.newHighlight.start;
        var end = window.newHighlight.end;
        var context_id = window.newHighlight.context_id;
        $.ajax({
            url: window.urlPrefix + 'new_annotation',
            data: {
                'text': text,
                'start': start,
                'end': end,
                'context_id': context_id,
                'place_name': place_name,
                'geotext': new ol.format.WKT().writeFeature(feature[0])
            },
            type: 'post',
            success: function () {
                $('#search_text').val('');
                reloadHighlights(context_id);
                window.drawSource.clear();
                $('#save_shape').attr('disabled', 'true');
                $('#save_annotation').attr('disabled', 'true');
            }
        })
    });
    $('#draw_line,#draw_polygon').click(function() {
        $('#draw_line,#draw_polygon').attr('disabled', 'true');
        window.drawSource.clear();
        var value = $(this).is('#draw_line') ? 'LineString' : 'Polygon';
        window.draw = new ol.interaction.Draw({
            source: window.drawSource,
            type: /** @type {ol.geom.GeometryType} */ (value)
        });
        window.map.addInteraction(window.draw);
        window.draw.on('drawend', endDrawing);
        $('#searcher_overlay').show();
    });

    function endDrawing() {
        window.map.removeInteraction(window.draw);
        $('#draw_line').removeAttr('disabled');
        $('#draw_polygon').removeAttr('disabled');
        $('#save_shape').removeAttr('disabled');
        $('#searcher_overlay').hide();
    }

    $('body').on('click', '.place.item', function() {
        var place_id = this.getAttribute('data-place-id');
		var geotext = '';
		for (var i = 0; i < window.searchResults.length; i ++) {
			if (window.searchResults[i].place_id == place_id) {
				geotext = window.searchResults[i].geotext;
				break;
			}
		}
        showDetail(geotext);
        window.newHighlight.place_id = place_id;
        delete window.newHighlight.custom_place_id;
        $('#save_annotation').removeAttr('disabled');
		if ($(this).parents('#local_results').length > 0) {
			// from local results
			var rank = $('#previous_annotations .item').length;
			window.newHighlight.rank = rank + $(this).parent().children('.item').index($(this)) + 1;
			window.newHighlight.rule = 'loc_' + window.sortBy;
		} else if ($(this).parents('#global_results').length > 0) {
			// from global results
			var rank = $('#previous_annotations .item').length +
				$('#local_results .item').length;
			window.newHighlight.rank = rank + $(this).parent().children('.item').index($(this)) + 1;
			window.newHighlight.rule = 'glob_prominence';
		} else {
			delete window.newHighlight.rank;
			delete window.newHighlight.rule;
		}
    }).on('click', '.previous_anno.item', function() {
		var place_id = this.getAttribute('data-place-id');
		if (this.getAttribute('data-place-type') == 'custom') {
			showDetail(window.matchedAnnotations[place_id].shape, 'custom');
			window.newHighlight.custom_place_id = place_id;
			delete window.newHighlight.place_id;
			$('#save_annotation').removeAttr('disabled');
		} else {
			showDetail(window.matchedAnnotations[place_id].shape);
			window.newHighlight.place_id = place_id;
			delete window.newHighlight.custom_place_id;
			$('#save_annotation').removeAttr('disabled');
		}
		window.newHighlight.rank = $(this).parent().children('.item').index($(this)) + 1;
		window.newHighlight.rule = 'previous_anno';
	});

	$('body').on('click', '#save_annotation', function(e) {
        e.preventDefault();
        if (Object.keys(window.newHighlight).length == 0) {
            alert('Error. Did you highlight any text?');
        }
        var data = {
            'text': $('#search_text').val(),
            'start': window.newHighlight.start,
            'end': window.newHighlight.end,
            'context_id': window.newHighlight.context_id,
            'geotext': window.geotext,
			'rank': window.newHighlight.rank,
			'rule': window.newHighlight.rule
        };
        if ('place_id' in window.newHighlight) {
            data['place_id'] = window.newHighlight.place_id;
        } else if ('custom_place_id' in window.newHighlight) {
            data['custom_place_id'] = window.newHighlight.custom_place_id;
        }
        $.ajax({
            url: window.urlPrefix + 'new_annotation',
            data: data,
            type: 'post',
            success: function() {
                $('#search_text').val('');
                reloadHighlights(window.newHighlight.context_id);
                $('#save_annotation').attr('disabled', 'true');
				$('#annotation_overlay').show();
				$('#previous_annotations,#local_results,#global_results').html('');

			}
        });
    });
});

function searchCallback() {
	// window.matchedAnnotations and window.searchResults should be ready
	if (window.searchResults.length > 0) {
		// find previous annotation and update window.currentFocus
		var currentLatest = {end: -1};
		var againstTarget = ' (calculated against <b>State College Borough</b>)';
		for (var highlight_id in window.highlightsData) {
			if (window.highlightsData[highlight_id].end < window.newHighlight.start &&
				window.highlightsData[highlight_id].end > currentLatest.end &&
				window.highlightsData[highlight_id].hasOwnProperty('place_id') &&
				window.highlightsData[highlight_id].place_id != null) { // not a custom place
				currentLatest = window.highlightsData[highlight_id];
			}
		}
		if (currentLatest.end != -1) {
			// transform currentLatest into address
			againstTarget = ' (calculated against <b>' + currentLatest.text + '</b>)';
			$.ajax({
				url: '//gir.ist.psu.edu/nominatim/details.php',
				data: {place_id: currentLatest.place_id},
				success: function(xhr) {
					// parse xhr into name/type
					window.currentFocus = {};
					for (var i = 0; i < $(xhr).length; i ++) {
						var segment = $($(xhr)[i]);
						if (['state', 'county', 'township', 'city', 'neighborhood'].includes(segment.find('.type').text())) {
							window.currentFocus[segment.find('.type').text()] = segment.find('.name').text();
						}
					}
					// update window.overallCentroid with currentLatest.shape
					var format = new ol.format.WKT();
					var feature = format.readFeature(currentLatest.shape);
					window.overallCentroid = ol.extent.getCenter(feature.getGeometry().getExtent());
					rankAndPresentResults(againstTarget);
				}

			});
		} else {
			rankAndPresentResults(againstTarget);
		}
	} else {
		$('#search_results').html('<b>No results found.</b>');
	}
}


function searchInPrevious(text) {
	window.matchedAnnotations = {};
	return $.ajax({
		url: window.urlPrefix + 'search_annotation',
		data: {text: text.trim()},
		success: function(xhr) {
			for (var i = 0; i < xhr.matches.length; i++) {
				var match = xhr.matches[i];
				window.matchedAnnotations[match.place_id] = match;
			}
			window.ajaxRemaining --;
			if (window.ajaxRemaining <= 0) {
				searchCallback();
			}
		}
	});
}

function searchLocal(searchtext, finalCallback) {
	searchtext = searchtext.trim().replace(' ', '+');
	window.searchResults = [];
	return $.ajax({
		url: '//gir.ist.psu.edu/nominatim/search.php',
		data: 'q=' + searchtext + '&format=json&addressdetails=1&polygon_text=1',
		success: function(xhr) {
			if (xhr.length == 0) {
				if (typeof finalCallback == 'function') {
					finalCallback();
				}
				return;
			}
			window.searchResults = window.searchResults.concat(xhr);
			var newquery = 'q=' + searchtext + '&format=json&addressdetails=1&polygon_text=1&exclude_place_ids=';
			for (var i = 0; i < window.searchResults.length; i++) {
				newquery  += window.searchResults[i].place_id + ',';
			}
			$.ajax({
				url: '//gir.ist.psu.edu/nominatim/search.php',
				data: newquery,
				success: function(xhr) {
					if (xhr.length == 0) {
						if (typeof finalCallback == 'function') {
							finalCallback();
						}
						return;
					}
					window.searchResults = window.searchResults.concat(xhr);
					var newnewquery = 'q=' + searchtext + '&format=json&addressdetails=1&polygon_text=1&exclude_place_ids=';
					for (var i = 0; i < window.searchResults.length;i ++) {
						newnewquery  += window.searchResults[i].place_id + ',';
					}
					$.ajax({
						url: '//gir.ist.psu.edu/nominatim/search.php',
						data: newnewquery,
						success: function(xhr) {
							window.searchResults = window.searchResults.concat(xhr);
							if (typeof finalCallback == 'function') {
								finalCallback();
							}
						}
					});
				}
			});
		}
	});
}

function searchGlobal(searchtext) {
	searchtext = searchtext.trim().replace(' ', '+');
	window.searchResults = [];
	$.ajax({
		url: '//nominatim.openstreetmap.org/search.php',
		data: 'q=' + searchtext + '&format=json&countrycodes=us&polygon_text=1&addressdetails=1',
		success: function (xhr) {
			window.searchResults = xhr;
			showGlobalResults();
		}
	});
}


function rankAndPresentResults(againstTarget) {
	var wgs84Sphere = new ol.Sphere(6378137);
	var i;

	// update searchresult info
	for (i = 0; i < window.searchResults.length; i ++) {
		var result = window.searchResults[i];

		// calculate geographic distance
		result.distance = wgs84Sphere.haversineDistance(window.overallCentroid, [
			result.lon,
			result.lat
		]);

		// calculate ontological distance
		result.ont_distance = getOntologyDistance(result.address);

		// calculate frequency (if any)
		result.freq = 0;
		if (result.place_id in window.matchedAnnotations) {
			result.freq = window.matchedAnnotations[result.place_id].freq;
		}
	}

	if (window.strategy == 'ogd') {
		window.searchResults.sort(function(a, b) {
			if (a.ont_distance.code < b.ont_distance.code) {
				return 1;
			}
			if (a.ont_distance.code > b.ont_distance.code) {
				return -1;
			}
			return (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0);
		});
	} else if (window.strategy == 'odg') {
		window.searchResults.sort(function(a, b) {
			if (a.ont_distance.code < b.ont_distance.code) {
				return 1;
			}
			if (a.ont_distance.code > b.ont_distance.code) {
				return -1;
			}
			return (a.freq < b.freq) ? 1 : ((b.freq < a.freq) ? -1 : 0);
		});
	} else {
		window.searchResults.sort(function(a, b) {
			if (a.freq < b.freq) {
				return 1;
			}
			if (a.freq > b.freq) {
				return -1;
			}
			return (a.ont_distance.code < b.ont_distance.code) ? 1 : ((b.ont_distance.code < a.ont_distance.code) ? -1 : 0);
		});
	}

	var html = againstTarget + '<div class="ui celled list">';
	for (i = 0; i < window.searchResults.length; i ++) {
		var shortname = window.searchResults[i].display_name.replace(/, United States of America$/, '');
		if (window.searchResults[i].ont_distance.code >= 1 && window.currentFocus.state) {
			shortname = shortname.replace(window.currentFocus.state + ', ', '');
		}
		if (window.searchResults[i].ont_distance.code >= 2 && window.currentFocus.county) {
			shortname = shortname.replace(window.currentFocus.county + ', ', '');
		}

		var distance = window.searchResults[i].distance / 1609.34;
		distance = distance.toPrecision(3);
		html += '<a class="place item" data-place-id="' + window.searchResults[i].place_id + '">' +
			'<span class="ui grey circular label">' + window.searchResults[i].ont_distance.text + '</span>' +
			'<span class="ui label">' + distance + ' mi</span>' +
			shortname +
			(window.searchResults[i].freq > 0 ? ' (' + window.searchResults[i].freq + ')' : '' )
			+ '</a>';
	}
	html += '</div>';
	$('#search_results').html(html);
}

function showGlobalResults() {
	if (window.searchResults.length > 0) {
		var html = '<div class="ui celled list">';
		window.searchResults.sort(function(a, b) {
			if (b.importance >= a.importance) {
				return 1;
			}
			return -1;
		});
		for (var i =0; i < window.searchResults.length; i ++) {
			var result = window.searchResults[i];
			var shortname = result.display_name.replace(/, United States of America$/, '');
			html += '<a class="place item" data-place-id="' + result.place_id + '">' +
				(result.icon ? '<img class="ui avatar image" src="' + result.icon + '">' : '') +
				shortname +
				' (' + result.importance.toPrecision(3) + ')</a>';
		}
		html += '</div>';
		$('#search_results').html(html);
	} else {
		$('#search_results').html('<b>No global results.</b>');
	}

}

function getOntologyDistance(address) {
	var currentFocus = window.currentFocus;
	var dist = {'code': 0, 'text': 'US'}; // country
	if (! (address.state == currentFocus.state)) return dist;
	dist = {'code': 1, 'text': 'State'};
	if (!
		('county' in address && 'county' in currentFocus && address.county == currentFocus.county)
	) return dist;
	dist = {'code': 2, 'text': 'County'};
	if (!
		('city' in address && 'city' in currentFocus && address.city == currentFocus.city) ||
		('township' in address && 'township' in currentFocus && address.township == currentFocus.township)
	) return dist;
	dist = {'code': 3, 'text': 'City'};
	if (!
		('neighbourhood' in address && 'neighborhood' in currentFocus && address.neighbourhood == currentFocus.neighbourhood)
	) return dist;
	dist = {'code': 4, 'text': 'Neighbor'};
	return dist;
}

function initAnnotationControls() {
    $('body').on('mousedown', '#doc_content', function (e) {
        if ($(e.target).is('u.tk')) {
            var $target = $(this);
            $(window).mousemove(function (e2) {
                if ($(e2.target).hasClass('tk')) {
                    window.isDragging = true;
                    window.newHighlight.end = e2.target.getAttribute('data-id');
                    var min = Math.min(window.newHighlight.start, window.newHighlight.end);
                    var max = Math.max(window.newHighlight.start, window.newHighlight.end);
                    $target.find('.tk').removeClass('highlighted');
                    for (var i = min; i <= max; i++) {
                        $target.find('.tk[data-id="' + i + '"]').addClass('highlighted');
                    }
                } else {
                    $target.find('.tk').removeClass('highlighted');
                }
            });
            window.newHighlight.start = e.target.getAttribute('data-id');
            window.newHighlight.end = e.target.getAttribute('data-id');
        }
    }).on('mouseup', '#doc_content', function (e) {
        $(window).off('mousemove');
        var wasDragging = window.isDragging;
        window.isDragging = false;
        if (wasDragging) {
            var min = Math.min(window.newHighlight.start, window.newHighlight.end);
            var max = Math.max(window.newHighlight.start, window.newHighlight.end);
            window.newHighlight.start = min;
            window.newHighlight.end = max;

            if ($(this).find('.tk.highlighted').length) {
                var highlights = $(this).find('.tk.highlighted');
                var text = "";
                for (var i = 0; i < highlights.length; i++) {
                    text += highlights[i].textContent;
                }
				//getRecommendation(text);
                window.newHighlight.text = text;
                window.newHighlight.context_id = $('#doc_content').attr('data-article-id');
                $('#search_text').val(window.newHighlight.text);
                $('#annotation_overlay').hide();
            }
        } else { // just clicking
            $(this).find('.tk').removeClass('highlighted');
            window.newHighlight = {};
            $('#search_text').val('');
            $('#annotation_overlay').show();
        }
    }).on('click', '.tk.p,.tk.cp', function (e) {
        e.stopPropagation();
        var highlight_id = this.getAttribute('data-hl-id').split(' ')[0];
        var highlightData = window.highlightsData[highlight_id];
        $('#search_text').val(highlightData.text);
		if (!highlightData['shape']) return; //non-resolvable cases
        if ($(this).hasClass('cp')) { // update custom_shape select
            showDetail(highlightData['shape'], 'custom');
        } else {
            showDetail(highlightData['shape']);
        }
    });


}
function reloadHighlights(context_id) {
    $('#doc_content .tk').removeClass('highlighted');
	window.highlightsData = {};
	window.overallCentroid = [-77.864398, 40.792031];
	window.drawSource.clear();

	window.currentFocus = {
		coordinates: [-77.864398, 40.792031],
		state: 'Pennsylvania',
		county: 'Centre County',
		city: 'State College',
		neighbourhood: 'Downtown State College'
	};
    return $.ajax({
        url: window.urlPrefix + 'load_annotation',
        type: 'post',
        data: {
            context_id: context_id
        },
        success: function(xhr) {
            for (var i = 0; i < xhr.highlights.length; i ++) {
                highlight(xhr.highlights[i]);
                window.highlightsData[xhr.highlights[i].id] = xhr.highlights[i];
            }
        }
    });
}
function loadDocument(id) {
    return $.ajax({
        url: window.urlPrefix + 'get_doc',
        data: {
            'id': id
        },
        success: function(xhr) {
            $('#article_title').text('[' + xhr.id + '] ' + xhr.title + ' (' + xhr.date + ')');
			var metadata = '';
			metadata += '<p>Title: ' + xhr.title + '</p>';
			metadata += '<p>Date: ' + xhr.fulltime + '</p>';
			metadata += '<p>Original URL: <a href="' + xhr.url + '" target="_blank">' + xhr.url + '</a></p>';
            $('#article_metadata').html(metadata);
			var sentences = xhr.content;
            $('#doc_content')
                .html(sentences)
                .attr("data-article-id", id);
            reloadHighlights(id);
        }
    });
}


function highlight(highlight) {
    var $context = $('#doc_content');
    var className;
    if ('place_id' in highlight) {
        className = 'p'; // 'place'
    } else {
        className = 'cp'; // 'custom place'
    }
    for (var i = highlight.start; i <= highlight.end; i++) {
        var $token = $context.find('.tk[data-id="' + i + '"]');
        if (typeof $token.attr('data-hl-id') == 'undefined') { // new highlight for this word
            $token.addClass(className).attr('data-hl-id', highlight.id);
        } else {
            var curr_id = $token.attr('data-hl-id'); // append highlight for this word
            $token.addClass(className).attr('data-hl-id', curr_id + ' ' + highlight.id);
        }
    }
}

function highlightAndJump(highlight) {
    var $context = $('#doc_content');
    $('#doc_content .tk.highlighted').removeClass('highlighted');
    var $token;
    for (var i = highlight.start; i <= highlight.end; i++) {
        $token = $context.find('.tk[data-id="' + i + '"]');
        $token.addClass('highlighted');
    }
    // scroll to token
    var elOffset = $token.offset().top + $context.scrollTop();
    var windowHeight = $context.height();
    $context.scrollTop(elOffset - (windowHeight / 2));
}

function showDetail(geotext, shapetype) {
    window.vectorSource.clear();
    window.geotext = geotext;

    var format = new ol.format.WKT();
    var feature = format.readFeature(geotext);
    feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    if (shapetype == 'custom') {
        feature.setStyle(window.vectorStyles.custom);
    } else {
        feature.setStyle(window.vectorStyles.nominatim);
    }
    window.vectorSource.addFeature(feature);
    window.map.getView().fit(window.vectorSource.getExtent(), window.map.getSize(), {
		maxZoom: 16
	});
}
function initmap() {

    window.vectorSource = new ol.source.Vector();
    window.drawSource = new ol.source.Vector();

    window.vectorStyles = {
        nominatim: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'blue',
                width: 3
            }),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 0.1)'
            }),
            image: new ol.style.Circle({
                radius: 15,
                fill: new ol.style.Fill({
                    color: 'blue'
                })
            })
        }),
        custom: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#FF66CC',
                width: 3
            }),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 0.1)'
            }),
            image: new ol.style.Circle({
                radius: 15,
                fill: new ol.style.Fill({
                    color: '#FF66CC'
                })
            })
        })
    };

    window.map = new ol.Map({
        target: 'map',
        interactions: ol.interaction.defaults({doubleClickZoom: false}),
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            new ol.layer.Vector({
                source: window.vectorSource,
            }),
            new ol.layer.Vector({
                source: window.drawSource,
                style: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.2)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ff66cc',
                        width: 3
                    }),
                    image: new ol.style.Circle({
                        radius: 7,
                        fill: new ol.style.Fill({
                            color: '#ff66cc'
                        })
                    })
                })
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([-77.86, 40.80]),
            maxZoom: 19,
            zoom: 12
        })
    });
}
function getSelectionText() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}
