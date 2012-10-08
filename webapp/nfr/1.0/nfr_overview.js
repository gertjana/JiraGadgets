(function($) {

    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var prefs = new gadgets.Prefs();
    var project = prefs.getString("project");
    var version = prefs.getString("version");
    var nfrs = {};

    var baseSearchRequest = "http://" + this.location.host + "/jira/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=";
    var baseIssueRequest  = "http://" + this.location.host + "/jira/secure/IssueNavigator.jspa?reset=true&jqlQuery=";

    var JqlQuery = {
        StoriesForAProject                : "Project%3D{0}+AND+issueType%3DStory+AND+Status!%3DClosed",
        StoriesForAProjectAndVersion      : "Project%3D{0}+AND+issueType%3DStory+AND+Status!%3DClosed+AND+fixVersion%3D%22{1}%22",
        QueryNFRForAProject               : "Project+%3D+{0}+and+NFR+%3D+%22{1}%22",
        QueryNFRForAProjectAndVersion     : "Project+%3D+{0}+and+fixVersion%3D%22{1}%22+and+NFR+%3D+%22{2}%22"
    };

    var childNodeTemplate = '{"children": [],"data": {"count": "{1}", "link": "{2}"},"id": "{0}","name": "{0}"}';
    var jsonNodeTemplate = '{"children": [{0}], "data": {}, "id": "root", "name": "NFRs"}';

    gadgets.util.registerOnLoadHandler(fetchIssues);

    function fetchIssues() {
        gadgets.window.adjustHeight();
        if (!project) {
            document.getElementById('content_div').innerHTML = "Please configure project and optionally version";
            msg.dismissMessage(loadMessage);
            gadgets.window.adjustHeight();
        }  else {
            gadgets.window.setTitle("NFR Overview - Project:{0} Version:{1}".format(project, version));

            var jqlQuery = JqlQuery.StoriesForAProject.format(encodeURIComponent(project));
            if (version) {
                jqlQuery = JqlQuery.StoriesForAProjectAndVersion.format(encodeURIComponent(project), encodeURIComponent(version));
            }
            var url = baseSearchRequest + jqlQuery;
            log(url);
            var params = {};
            params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;

            gadgets.io.makeRequest(url, handleResponse, params);
        }
    }

    function handleResponse(obj) {
        var domData = obj.data;

        getNfrs(domData);
        renderNfrs();

        $('div.container').freetile();
        gadgets.window.adjustHeight();
    }

    function getNfrs(domData) {
        var itemNodes = domData.getElementsByTagName("item");

        for (var i = 0; i < itemNodes.length; i++) {
            var childNodes = itemNodes.item(i).childNodes;
            for (var j = 0; j < childNodes.length ; j++) {
                var childNode = childNodes.item(j);
                if (!isElement(childNode) || !childNode.firstChild) {
                    continue;
                }
                switch (childNode.nodeName) {
                    case "customfields":
                        var customFieldNodes = childNode.childNodes;
                        for (var k=0; k < customFieldNodes.length;k++) {
                            var customFieldNode = customFieldNodes.item(k)
                            if (!isElement(customFieldNode)) {continue;}
                            if (customFieldNode.getAttribute("id") == "customfield_11432") {
                                var customFieldValues = customFieldNode.getElementsByTagName("customfieldvalue");
                                for (var l=0;l<customFieldValues.length;l++) {
                                    var nfr = customFieldValues.item(l).firstChild.nodeValue;
                                    if (nfrs[nfr]) {
                                        nfrs[nfr] = nfrs[nfr] +1;

                                    } else {
                                        nfrs[nfr] = 1;
                                    }
                                }
                            }
                        }
                    break;
                }
            }
        }
    }

    function renderNfrs() {
        var children = "";
        var html = "<div class='title'><span class='grey'>Open NFR's for Project:</span> {0} <span class='grey'>and Version:</span> {1}</div>".format(project, (version ? version : "None"));
        html += "<div class='container'>";
        for (nfr in nfrs) {
            var size =  (nfrs[nfr] > 7) ? 7 : nfrs[nfr];
            var link;
            if (version) {
                link = baseIssueRequest+JqlQuery.QueryNFRForAProjectAndVersion.format(project, version, nfr);
            } else {
                link = baseIssueRequest+JqlQuery.QueryNFRForAProject.format(project, nfr);
            }
            children = children + childNodeTemplate.format(nfr, size, '');
            var text = "{1} ({0})".format(nfrs[nfr], nfr);
            html += "    <div class='nfr size_{0}'><a target='_blank' href='{1}'>{2}</a></div>".format(size, link, text);
        }

        children = children.substr(0, children.length-1);
        var json = jsonNodeTemplate.format(children);


        html += "</div><br/>";

        document.getElementById('content_div').innerHTML = html;
        msg.dismissMessage(loadMessage);
        gadgets.window.adjustHeight();
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
})(jQuery);