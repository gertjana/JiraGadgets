(function($) {
    function isInArray(item, ar) {
        for (var i=0;i<ar.length;i++) {
            var a = ar[i];
            if (a.name == item) {return i}
        }
        return -1;
    }

    function getSize(storypoints) {
        if (!storypoints || isNaN(storypoints)) {return 5;}
        return 10+parseFloat(storypoints);
    }

    function isElement(node) {
        return node.nodeType == 1;
    }

    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/\{(\d+)\}/g, function (m, n) { return args[n]; });
    };

    function log(text) {
        if (console){console.log(text);}
    }

    //com.atlassian.greenhopper.service.sprint.Sprint@7643377e[name=ST 2013 Sprint 5,closed=true,startDate=2013-02-01T06:30:34.734-08:00,endDate=2013-02-15T06:30:34.734-08:00,completeDate=2013-02-07T05:53:14.915-08:00,id=78]

    function extractSprintInfo(text) {
        var sprintInfo = {
            "name": "",
            "closed": "",
            "startDate": "",
            "endDate": "",
            "completeDate": "",
            "id": "",
            "openSP":0,
            "closedSP":0
        }
        var kvps = text.substring(text.indexOf("[")+1, text.lastIndexOf("]")).split(",");
        $.each(kvps, function(index, value) {
            var kvp = value.split("=")
            sprintInfo[kvp[0]] = kvp[1];
        })
        return sprintInfo;
    }


    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var prefs = new gadgets.Prefs();
    var project = prefs.getString("project");
    var version = prefs.getString("version");

    var baseRequest = "http://" + this.location.host + "/jira";
    var restVersions = "/rest/api/2/project/{0}/versions";
    var restSearch = "/rest/api/2/search?jql={0}";

    //stores all active versions
    var versions = new Array();

    gadgets.util.registerOnLoadHandler(fetchVersions);

    function fetchVersions() {
        var query = "Project%3D{0}+AND+Type%3DStory+AND+fixVersion%3D%22{1}%22+AND+Sprint+is+not+EMPTY";

        var url = baseRequest + restSearch.format(query.format("ST", "ST+2013"));

        var params = {};
        log(url);
        gadgets.io.makeRequest(url, handleResponse, params);
    }

    function handleResponse(obj) {
        var data  = $.parseJSON( obj.data);

        $.each(data.issues, function(index, value) {
            var fields = value.fields;

            var sprint = fields.customfield_11631[0];
            var storypoints = fields.customfield_10013;
            var sprintInfo = extractSprintInfo(sprint);


            versions[versions.length]

        })
        var size = versions.length;
    }
})(jQuery);