$(document).ready(function() {

    window.highlightText = {};
    window.newHighlight = {};
    window.highlightsData = {};
    window.isDragging = false;

    window.map = null;

    initmap();

    $('body').on('mousedown', '#doc_content', function(e) {
        if ($(e.target).is('u.tk')) {
            var $target = $(this);
            $(window).mousemove(function(e2) {
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
    }).on('mouseup', '#doc_content', function(e) {
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
                for (var i = 0; i < highlights.length; i ++) {
                    text += highlights[i].textContent;
                };
                window.newHighlight.text = text;
                window.newHighlight.context_id = $('#doc_content').attr('data-article-id');
                $('#search_text').val(window.newHighlight.text);
            }
        } else { // just clicking
            $(this).find('.tk').removeClass('highlighted');
            window.newHighlight = {};
        }
    }).on('click', '.tk.p', function(e) {
        e.stopPropagation();
        var highlight_id = this.getAttribute('data-hl-id').split(' ')[0];
        var highlightData = window.highlightsData[highlight_id];
        $('#search_text').val(highlightData.text);
        $('#place_id').val(highlightData.place_id);
        showDetail(highlightData.place_id, highlightData['shape']);
    });
    $('#search_text').keypress(function (e) {
        if (e.which == 13) {
            $('#search_nominatim').trigger('click');
            return false;
        }
    });
    $('body').on('click', '#show_article_list', function() {
        $('.ui.sidebar')
            .sidebar('setting', 'dimPage', 'false')
            .sidebar('toggle');
    });
    $('body').on('click', '.article.title', function() {
        var id = this.getAttribute('data-id');
        $.ajax({
            url: 'doc',
            data: {
                'id': id
            },
            success: function(xhr) {
                $('#article_title').text(xhr.title);
                var sentences = xhr.content;
                $('#doc_content').html(sentences);
                $('#doc_content').attr("data-article-id", id);
                reloadHighlights(id);
            }
        });
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
        feature[0].getGeometry().transform('EPSG:3857', 'EPSG:4326');

        var text = $('#search_text').val();
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
                'geotext': new ol.format.WKT().writeFeature(feature[0])
            },
            type: 'post',
            success: function () {
                $('#place_id').val('');
                $('#search_text').val('');
                reloadHighlights(context_id);
                window.drawSource.clear();
                $('#save_shape').attr('disabled', 'true');
            }
        })
    });
    $('#draw_line,#draw_polygon').click(function() {
        $('#draw_line,#draw_polygon').attr('disabled', 'true');
        window.drawSource.clear();
        $('#place_id').val('');
        $(this).text('Double click the map to end drawing');
        ol.interaction.defaults({
            doubleClickZoom: false
        });

        var value = $(this).is('#draw_line') ? 'LineString' : 'Polygon';
        window.draw = new ol.interaction.Draw({
            source: window.drawSource,
            type: /** @type {ol.geom.GeometryType} */ (value)
        });
        window.map.addInteraction(window.draw);
        window.draw.on('drawend', endDrawing);

    });

    function endDrawing() {
        window.map.removeInteraction(window.draw);
        $('#draw_line').removeAttr('disabled');
        $('#draw_line').text('Draw line');
        $('#draw_polygon').removeAttr('disabled');
        $('#draw_polygon').text('Draw polygon');
        ol.interaction.defaults({
            doubleClickZoom: true
        });
        $('#save_shape').removeAttr('disabled');
    }

    function showResults(results) {
        window.searchResults = {};
        var html = '<div class="ui ordered list">';
        if (results.length == 0) html += '<div class="item">No result</div>';
        results.sort(function(a,b) {return (a.importance < b.importance) ? 1 : ((b.importance < a.importance) ? -1 : 0);} );
        for (var i =0; i < results.length; i ++) {
            html += '<a class="place item" data-place-id="' + results[i].place_id + '">' + results[i].display_name + ' (' + results[i].type + ')</a>';
            window.searchResults[results[i].place_id] = results[i];
        }
        html += '</div>';
        $('#search_results').html(html);
    }

    $('body').on('click', '.place.item', function() {
        var place_id = this.getAttribute('data-place-id');
        showDetail(place_id);
        $('#place_id').val(place_id);
    });
    $('body').on('click', '#save_annotation', function(e) {
        e.preventDefault();
        if (Object.keys(window.newHighlight).length == 0) {
            alert('Error. Did you highlight any text?');
        };
        var text = $('#search_text').val();
        var place_id = $('#place_id').val();
        var start = window.newHighlight.start;
        var end = window.newHighlight.end;
        var context_id = window.newHighlight.context_id;
        $.ajax({
            url: 'new_annotation',
            data: {
                'text': text,
                'place_id': place_id,
                'start': start,
                'end': end,
                'context_id': context_id,
                'geotext': window.geotext,
            },
            type: 'post',
            success: function() {
                $('#place_id').val('');
                $('#search_text').val('');
                reloadHighlights(context_id);
            }
        });
    });
});

function reloadHighlights(context_id) {
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
        },
        error: function(xhr) {
            if (xhr.status == 403) {
                Utils.notify('error', xhr.responseText);
            }
        }
    });
}

function reloadSavedShapes() {
    $.ajax({

    });
}

function highlight(highlight) {
    var $context = $('#doc_content');
    // loop over all words in the highlight
    for (var i = highlight.start; i <= highlight.end; i++) {
        var $token = $context.find('.tk[data-id="' + i + '"]');
        if (typeof $token.attr('data-hl-id') == 'undefined') { // new highlight for this word
            $token.addClass('p').attr('data-hl-id', highlight.id);
        } else {
            var curr_id = $token.attr('data-hl-id'); // append highlight for this word
            $token.addClass('p').attr('data-hl-id', curr_id + ' ' + highlight.id);
        }
    }
}

function showDetail(place_id, geotext) {
    window.vectorSource.clear();
    if (typeof geotext == 'undefined') { // when clicking search result
        window.geotext = window.searchResults[place_id].geotext;
    } else { // when clicking annotated text
        window.geotext = geotext;
    }

    var format = new ol.format.WKT();
    var feature = format.readFeature(window.geotext);
    feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    window.vectorSource.addFeature(feature);
    window.map.getView().fit(window.vectorSource.getExtent(), window.map.getSize());
}
function initmap() {

    window.vectorSource = new ol.source.Vector();
    window.drawSource = new ol.source.Vector();
    window.map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            new ol.layer.Vector({
                source: window.vectorSource,
                style: new ol.style.Style({
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
                    }),
                })
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
