$(document).ready(function() {

    window.highlightText = {};
    window.newHighlight = {};
    window.highlightsData = {};
    window.isDragging = false;

    window.customShapes = {};

    window.map = null;

    initmap();

    initAnnotationControls();
    reloadSavedShapes();


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
            url: 'activities',
            success: function(xhr) {
                $('#show_activities').text('Refresh activities');
                $('#activities').html(xhr.html);
                $('#activity_table').DataTable({
                    'ordering': false,
                    'scrollY': $('#activities').height() - 80,
                    'columns': [
                        null,
                        {'searchable': false},
                        null
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
    });
    $('body').on('click', '.article.title', function() {
        var id = this.getAttribute('data-id');
        loadDocument(id);
    });
    $('body').on('mouseup', '.doc_content', function(e) {
        var selected = getSelectionText();
        if (selected.length == 0) {
            $('#searchbox').removeAttr('style');
            return;
        };
        $('#search_text').val(selected);
    });
    $('body').on('click', '#search_nominatim', function(e) {
        e.preventDefault();
        $('#search_results').html('Searching...');
        var text = $('#search_text').val();
        var searchtext = text.trim().replace(' ', '+');
        var results = [];
        $.ajax({
            url: '//gir.ist.psu.edu/nominatim/search.php',
            data: 'q=' + searchtext + '&format=json&polygon_text=1',
            success: function(xhr) {
                if (xhr.length == 0) {
                    showResults(results);
                    return;
                }
                results = results.concat(xhr);
                var newquery = 'q=' + searchtext + '&format=json&polygon_text=1&exclude_place_ids=';
                for (var i = 0; i < results.length; i++) {
                    newquery  += results[i].place_id + ',';
                }
                $.ajax({
                    url: '//gir.ist.psu.edu/nominatim/search.php',
                    data: newquery,
                    success: function(xhr) {
                        if (xhr.length == 0) {
                            showResults(results);
                            return;
                        }
                        results = results.concat(xhr);
                        var newnewquery = 'q=' + searchtext + '&format=json&polygon_text=1&exclude_place_ids=';
                        for (var i = 0; i < results.length;i ++) {
                            newnewquery  += results[i].place_id + ',';
                        }
                        $.ajax({
                            url: '//gir.ist.psu.edu/nominatim/search.php',
                            data: newnewquery,
                            success: function(xhr) {
                                results = results.concat(xhr);
                                showResults(results);
                            }
                        });
                    }
                });
            }
        });
    }).on('click', '#search_global', function(e) {
        e.preventDefault();
        $('#search_results').html('Searching...');
        var text = $('#search_text').val();
        var searchtext = text.trim().replace(' ', '+');
        $.ajax({
            url: '//nominatim.openstreetmap.org/search.php',
            data: 'q=' + searchtext + '&format=json&polygon_text=1',
            success: function (xhr) {
                showResults(xhr);
            }
        });
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
            url: 'new_annotation',
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
                reloadSavedShapes();
                $('#save_annotation').attr('disabled', 'true');
                $('#custom_shapes').val('-1');
            }
        })
    });
    $('#draw_line,#draw_polygon').click(function() {
        $('#draw_line,#draw_polygon').attr('disabled', 'true');
        window.drawSource.clear();
        $('#place_id').val('');
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

    function showResults(results) {
        window.searchResults = {};
        var html = '<div class="ui ordered list">';
        if (results.length == 0) html += '<div class="item">No result</div>';
        results.sort(function(a,b) {return (a.importance < b.importance) ? 1 : ((b.importance < a.importance) ? -1 : 0);} );
        for (var i =0; i < results.length; i ++) {
            var shortname = results[i].display_name.replace(/, United States of America$/, '');
            html += '<a class="place item" data-place-id="' + results[i].place_id + '">' + shortname + ' (' + results[i].type + ')</a>';
            window.searchResults[results[i].place_id] = results[i];
        }
        html += '</div>';
        $('#search_results').html(html);
    }

    $('body').on('click', '.place.item', function() {
        $('#custom_shapes').val('-1');
        var place_id = this.getAttribute('data-place-id');
        var geotext = window.searchResults[place_id].geotext;
        showDetail(geotext);
        window.newHighlight.place_id = place_id;
        delete window.newHighlight.custom_place_id;
        $('#save_annotation').removeAttr('disabled');
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
            'geotext': window.geotext
        };
        if ('place_id' in window.newHighlight) {
            data['place_id'] = window.newHighlight.place_id;
        } else if ('custom_place_id' in window.newHighlight) {
            data['custom_place_id'] = window.newHighlight.custom_place_id;
        }
        $.ajax({
            url: 'new_annotation',
            data: data,
            type: 'post',
            success: function() {
                $('#search_text').val('');
                reloadHighlights(window.newHighlight.context_id);
                $('#save_annotation').attr('disabled', 'true');
                $('#custom_shapes').val('-1');
            }
        });
    });
});

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
                ;
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
        if ($(this).hasClass('cp')) { // update custom_shape select
            showDetail(highlightData['shape'], 'custom');
            $('#custom_shapes').val(highlightData.custom_place_id);
        } else {
            showDetail(highlightData['shape']);
            $('#custom_shapes').val('-1');
        }
    });
    $('#search_text').keypress(function (e) {
        if (e.which == 13) {
            $('#search_nominatim').trigger('click');
            return false;
        }
    });
    $('#custom_shapes').on('change', function() {
        var custom_place_id = $(this).find(':selected').val();
        if (custom_place_id in window.customShapes) {
            showDetail(window.customShapes[custom_place_id].geotext, 'custom');
            window.newHighlight.custom_place_id = custom_place_id;
            delete window.newHighlight.place_id;
            $('#save_annotation').removeAttr('disabled');
        } else {
            window.vectorSource.clear();
            delete window.newHighlight.custom_place_id;
            $('#save_annotation').attr('disabled', 'true');
        }
    });
}
function reloadHighlights(context_id) {
    $('#doc_content .tk').removeClass('highlighted');
    return $.ajax({
        url: 'load_annotation',
        type: 'post',
        data: {
            context_id: context_id
        },
        success: function(xhr) {
            window.highlightsData = {};
            for (var i = 0; i < xhr.highlights.length; i ++) {
                highlight(xhr.highlights[i]);
                window.highlightsData[xhr.highlights[i].id] = xhr.highlights[i];
            }
        }
    });
}
function loadDocument(id) {
    return $.ajax({
        url: 'doc',
        data: {
            'id': id
        },
        success: function(xhr) {
            $('#article_title').text('[' + xhr.id + '] ' + xhr.title + '(' + xhr.date + ')');
            var sentences = xhr.content;
            $('#doc_content')
                .html(sentences)
                .attr("data-article-id", id);
            reloadHighlights(id);
        }
    });
}
function reloadSavedShapes() {
    $.ajax({
        url: 'load_custom_shapes',
        type: 'post',
        success: function(xhr) {
            window.customShapes = {};
            var options = '<option value="-1">(Custom shape)</option>';
            for (var i = 0; i < xhr.places.length; i ++) {
                var shape = xhr.places[i];
                window.customShapes[shape.id] = shape;
                options += '<option value="' + shape.id + '">' +
                        shape.place_name + '</option>';
            }
            $('#custom_shapes').html(options);
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
    window.map.getView().fit(window.vectorSource.getExtent(), window.map.getSize());
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
