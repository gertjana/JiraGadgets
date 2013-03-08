(function($) {

    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var prefs = new gadgets.Prefs();
    var board = prefs.getString("board");
    var sprint = prefs.getString("sprint");
    var scale = prefs.getString("scale");
    var timeout = prefs.getInt("timeout");


    var chartUrl = "http://jira.global.sdl.corp:8080/jira/secure/RapidBoard.jspa?rapidView={0}&view=reporting&chart=burndownChart&sprint={1}";


    gadgets.util.registerOnLoadHandler(showChart);

    function showChart() {
        gadgets.window.adjustHeight();
        if (!board || !sprint) {
            document.getElementById('content_div').innerHTML = "Please configure board and sprint";
            msg.dismissMessage(loadMessage);
            gadgets.window.adjustHeight();
        }  else {
            var url = chartUrl.format(board, sprint);
            $('iframe#chart').attr('src',url);

            window.setTimeout( function() {
                // Remove any excess information from the page
                $('#header', $('iframe#chart').contents()).hide();
                $('.ghx-feedback', $('iframe#chart').contents()).hide();
                $('.aui-dd-link', $('iframe#chart').contents()).hide();
                $('#announcement-banner', $('iframe#chart').contents()).hide();
                $('#ghx-operations', $('iframe#chart').contents()).hide();
                $('#ghx-chart-data', $('iframe#chart').contents()).hide();
                $('#ghx-chart-overview-group', $('iframe#chart').contents()).hide();
                $('#ghx-board-name', $('iframe#chart').contents()).hide();
                $('#ghx-chart-nav-wrap', $('iframe#chart').contents()).hide();
                $('#ghx-chart-controls-wrap', $('iframe#chart').contents()).hide();
                $('#ghx-chart-controls-group', $('iframe#chart').contents()).hide();

                $('body', $('iframe#chart').contents())
                    .css('zoom', scale)
                    .css('-moz-transform','scale('+scale+')')
                    .css('moz-transform-origin','0 0')
                    .css('-o-transform','scale('+scale+')')
                    .css('o-transform-origin','0 0')
                    .css('-webkit-transform','scale('+scale+')')
                    .css('-webkit-transform-origin','0 0');

                $('#content_div').height($('#ghx-chart-content', $('iframe#chart').contents()).height()*scale)
                gadgets.window.adjustHeight();
            }, timeout)
            msg.dismissMessage(loadMessage);
        }
    }

    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/\{(\d+)\}/g, function (m, n) { return args[n]; });
    };

    function log(text) {
        if (console){console.log(text);}
    }


})(jQuery);