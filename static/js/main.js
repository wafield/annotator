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
    $('#draw_line').click(function() {
        window.drawControls.line.activate();
    });
    $('#draw_polygon').click(function () {
        window.drawControls.polygon.activate();
    });
    $('#draw_line,#draw_polygon').click(function() {
        $('#draw_line,#draw_polygon').attr('disabled', 'true');
        $(this).text('Double click the map to end drawing');
    });

    function endDrawing() {
        $('#draw_shape').removeAttr('disabled');
        $('#draw_shape').text('Draw');
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
        var geotext = window.geotext;
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

function highlight(highlight) {
    var $context = $('#doc_content');
    // loop over all words in the highlight
    for (var i = highlight.start; i <= highlight.end; i++) {
        var $token = $context.find('.tk[data-id="' + i + '"]');
        if (typeof $token.attr('data-hl-id') == 'undefined') { // new highlight for this word
            $token.addClass('p').attr('data-hl-id', highlight.id);
        } else {
            var curr_id = $token.attr('data-hl-id'); // append highlight for this word
            $token.addClass(className).attr('data-hl-id', curr_id + ' ' + highlight.id);
        }
    }
}

function showDetail(place_id, geotext) {
    window.vectorLayer.destroyFeatures();
    if (typeof geotext == 'undefined') { // when clicking search result
        window.geotext = window.searchResults[place_id].geotext;
    } else { // when clicking annotated text
        window.geotext = geotext;
    }

    var proj_EPSG4326 = new OpenLayers.Projection("EPSG:4326");
    var proj_map = window.map.getProjectionObject();

    var freader = new OpenLayers.Format.WKT({
        'internalProjection': proj_map,
        'externalProjection': proj_EPSG4326
    });

    var feature = freader.read(window.geotext);
    if (feature) {
        window.map.zoomToExtent(feature.geometry.getBounds());
        feature.style = {
            strokeColor: "#75ADFF",
            fillColor: "#F0F7FF",
            strokeWidth: 5,
            strokeOpacity: 0.75,
            fillOpacity: 0.75,
            pointRadius: 50
        };

        vectorLayer.addFeatures([feature]);
    }
}
function initmap() {

    window.map = new OpenLayers.Map("map", {
        controls:[
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.PanZoomBar(),
            new OpenLayers.Control.Attribution(),
        ],
        maxExtent: new OpenLayers.Bounds(-13618945.057011, 2061426.8121267, -7220248.546093, 7687192.0931325),
        maxResolution: 156543.0399,
        numZoomLevels: 19,
        units: 'm',
        projection: new OpenLayers.Projection("EPSG:900913"),
        displayProjection: new OpenLayers.Projection("EPSG:4326")
    });

    var drawLayer = new OpenLayers.Layer.Vector("Draw Layer");

    window.drawControls = {
        line: new OpenLayers.Control.DrawFeature(drawLayer,
            OpenLayers.Handler.Path),
        polygon: new OpenLayers.Control.DrawFeature(drawLayer,
            OpenLayers.Handler.Polygon),
    };

    window.map.addControl(drawControls.line);
    window.map.addControl(drawControls.polygon);

    window.map.addLayer(new OpenLayers.Layer.OSM.Mapnik("Default"));
    window.map.addLayer(drawLayer);

    var layer_style = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    layer_style.fillOpacity = 0.2;
    layer_style.graphicOpacity = 0.2;

    window.vectorLayer = new OpenLayers.Layer.Vector("Points", {style: layer_style});
    window.map.addLayer(window.vectorLayer);

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
