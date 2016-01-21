$(document).ready(function() {

    window.highlightText = {};
    window.newHighlight = {};
    window.highlightsData = [];
    window.isDragging = false;


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
                console.log(window.newHighlight);
            }
        } else { // just clicking
            $(this).find('.tk').removeClass('highlighted');
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
        document.getElementById('map').src = '/nominatim/search.php?q=' + searchtext;
    });
    $('body').on('click', '#save_annotation', function(e) {
        e.preventDefault();
        var text = $('#search_text').val();
        var place_id = $('#place_id').val();
        $.ajax({
            url: 'new_annotation',
            data: {
                'text': text,
                'place_id': place_id
            },
            type: 'post',
            success: function() {
                $('#place_id').val('');
                alert('saved!');
            }
        });
    });
});

function getSelectionText() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}
