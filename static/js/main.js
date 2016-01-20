$(document).ready(function() {
    $('body').on('click', '.article.title', function() {
        var id = this.getAttribute('data-id');
        $.ajax({
            url: 'doc',
            data: {
                'id': id
            },
            success: function(xhr) {
                $('#doc_container').html(xhr.html).show();
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
