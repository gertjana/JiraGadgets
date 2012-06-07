(function() {

    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var cnt = 0;

    var prefs = new gadgets.Prefs();
    var project = prefs.getString("project");
    var version = prefs.getString("version");

    var baseSearchRequest = "http://" + this.location.host + "/jira/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=";
    var JqlQuery = {
        Epic                : "%22Epic/Theme%22%3D{0}+AND+Type%3DStory",
        Epics               : "project%3D{0}+AND+Type%3DEpic",
        EpicsForVersion     : "project%3D{0}+AND+Type%3DEpic+AND+fixVersion=%22{1}%22"
    };
    gadgets.util.registerOnLoadHandler(fetchIssues);

    function fetchIssues() {
        gadgets.window.adjustHeight();
        if (!project) {
            document.getElementById('content_div').innerHTML = "Please configure project and optionally version";
            msg.dismissMessage(loadMessage);
            gadgets.window.adjustHeight();
        }  else {
            var jqlQuery = JqlQuery.Epics.format(encodeURIComponent(project));
            if (version) {
                jqlQuery = JqlQuery.EpicsForVersion.format(encodeURIComponent(project), encodeURIComponent(version));
            }
            var url = baseSearchRequest + jqlQuery;

            var params = {};
            params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;

            gadgets.io.makeRequest(url, handleResponse, params);
        }
    }

    function handleResponse(obj) {
        var domData = obj.data;

        getEpics(domData);

        renderEpics();

        for (var epickey in epicsModel.getAll()) {
            renderItemStatus(epickey);
        }

        setTimeout(renderStatuses, 2000);

        gadgets.window.adjustHeight();
    }

    function getEpics(domData) {
        var itemNodes = domData.getElementsByTagName("item");

        for (var i = 0; i < itemNodes.length; i++) {
            var item = {
                parent:null
            };

            var childNodes = itemNodes.item(i).childNodes;
            for (var j = 0; j < childNodes.length ; j++) {
                var childNode = childNodes.item(j);
                if (!isElement(childNode) || !childNode.firstChild) {
                    continue;
                }
                switch (childNode.nodeName) {
                    case "key":
                        item.key = childNode.firstChild.nodeValue;
                        break;
                    case "title":
                        item.name = childNode.firstChild.nodeValue;
                        break;
                    case "description":
                        item.desc = childNode.firstChild.nodeValue;
                        break;
                    case "link":
                        item.link = childNode.firstChild.nodeValue;
                        break;
                    case "customfields":
                        var customFieldNodes = childNode.childNodes;
                        for (var k=0; k < customFieldNodes.length;k++) {
                            var customFieldNode = customFieldNodes.item(k)
                            if (!isElement(customFieldNode)) {continue;}
                            if (customFieldNode.getAttribute("id") == "customfield_10011") {
                                item.parent = customFieldNode.getElementsByTagName("label")[0].firstChild.nodeValue;
                            }
                        }
                        break;
                }
            }

            epicsModel.create(item.key, item.name, item.link, item.parent, null);
        }
        epicsModel.sort();
    }


    function isElement(node) {
      return node.nodeType == 1;
    }

    function renderItemStatus(key){

        var url = baseSearchRequest + JqlQuery.Epic.format(key);
        var params = {};
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;

        gadgets.io.makeRequest(url, handleStatusResponse, params);
    }

    function handleStatusResponse(obj){
        var domData = obj.data;
        var status = {
            original :0,
            remaining :0,
            open:0,
            closed:0,
            total:0,
            openStorypoints:0,
            closedStorypoints:0
        };
        var epic_key = "";

        var itemNodes = domData.getElementsByTagName("item");

        status.total = itemNodes.length;
        for (var i = 0; i < itemNodes.length; i++) {
            var childNodes = itemNodes.item(i).childNodes;
            var item= {
                original:0,
                remaining:0,
                storypoints:0
            };
            for (var j = 0; j < childNodes.length ; j++) {

                var childNode = childNodes.item(j);
                if (!isElement(childNode) || !childNode.firstChild) {
                    continue;
                }
                switch (childNode.nodeName) {
                    case "key":
                        item.key = childNode.firstChild.nodeValue;
                        break;
                    case "aggregatetimeoriginalestimate":
                        if (!isNaN(childNode.getAttribute("seconds"))) {
                            item.original = parseInt(childNode.getAttribute("seconds"));
                        }

                        break;
                    case "aggregatetimeremainingestimate":
                        if (!isNaN(childNode.getAttribute("seconds"))) {
                            item.remaining = parseInt(childNode.getAttribute("seconds"));
                        }
                        break;
                    case "status":
                        item.status = childNode.firstChild.nodeValue;
                        break;
                    case "customfields":
                        var customFieldNodes = childNode.childNodes;
                        for (var k=0; k < customFieldNodes.length;k++) {
                            var customFieldNode = customFieldNodes.item(k)
                            if (!isElement(customFieldNode)) {continue;}
                            if (customFieldNode.getAttribute("id") == "customfield_10011") {
                                epic_key = customFieldNode.getElementsByTagName("label")[0].firstChild.nodeValue;
                            }
                            if (customFieldNode.getAttribute("id") == "customfield_10013") {
                                var sp = customFieldNode.getElementsByTagName("customfieldvalue")[0].firstChild.nodeValue;
                                item.storypoints = !isNaN(sp) ? parseFloat(sp) : 0;
                            }
                        }
                        break;
                }


            }
            status.original += item.original;
            status.remaining += item.remaining;

            if (item.status != "Closed") {
                status.open += 1;
                status.openStorypoints += item.storypoints;
            } else {
                status.closed += 1;
                status.closedStorypoints += item.storypoints;
            }

        }
        if (epicsModel.get(epic_key)) {
            var epic = epicsModel.epics[epic_key];
            epic.status = status;
            epic.factor = calculateStatusPer(status);
            epicsModel.epics[epic_key] = epic;
        }

        var statusHtml = status.open + "/" + status.closed + "/" + status.total + " Stories (Open/Closed/Total)|" + status.openStorypoints + "/" + status.closedStorypoints + " SP (Open/Closed) | " + (status.remaining/3600) + "h /" + (status.original/3600) + "h Hours (Remaining/Total)";

        var factor =  calculateStatusPer(status);

        var colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(factor)+";'>" + Math.round(factor*100) + "%</div>";

        if (document.getElementById(epic_key + "-status"))     {
            document.getElementById(epic_key + "-status").innerHTML = colorBoxHtml;
        }

        msg.dismissMessage(loadMessage);
        gadgets.window.adjustHeight();
    }

    function calculateStatusPer(status) {
        var factorHours = 0;
        if (status.original != 0) {
            // if we have some hours calculate factor
            factorHours = ((status.original - status.remaining) / status.original);
        }
        var factorStories = 0;
        if (status.openStorypoints + status.closedStorypoints != 0) {
            // if storypoints defined use them
            if (status.closedStorypoints == 0) {
                // if no sp on closed stories
                factorStories = 0;
            } else {
                factorStories= status.closedStorypoints / (status.openStorypoints + status.closedStorypoints);
                if (status.openStorypoints == 0) {
                    factorHours = 1;
                }
            }
        } else if (status.total != 0) {
            // else look at the open/closed story ratio
            factorStories = (status.closed / status.total);
            if (status.open == 0) {
                //only closed stories, no sp
                factorHours = 1;
            }
        } else {
            // if no stories at all, dont look at hours
            factorHours = 0;
        }
        // hours and stories are weighted equally
        return ((factorHours + factorStories) /2);
    }

    function calculateColor(factor) {
        if (factor > 0.5) {
            return "#" + toHex(512-factor*512) + "FF00";
        }
        if (factor == 0.5) {
            return "#FFFF00";
        }
        if (factor < 0.5) {
            return "#FF" + toHex(factor*512) + "00";
        }
    }

    function toHex(nr) {
        var hex = Math.round(nr).toString(16);
        if (hex.length==1) {
            hex = "0"+hex;
        }
        return hex;
    }

    function renderStatuses() {
        epicsModel.aggregateFactor();
        var epics = epicsModel.getAll();
        for (var key in epics) {
            var item = epics[key];

            var statusHtml = "No information for this Epic";
            if (item.status) {
                statusHtml = item.status.open + "/" + item.status.closed + "/" + item.status.total + " Stories (Open/Closed/Total)  | " +
                    item.status.openStorypoints + "/" + item.status.closedStorypoints + " SP (Open/Closed) | " +
                    (item.status.remaining/3600) + "h /" + (item.status.original/3600) + "h Hours (Remaining/Total)";
            }

            var colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(item.factor)+";'>" + Math.round(item.factor*100) + "%</div>";

            if (document.getElementById(key + "-status")) {
                document.getElementById(key + "-status").innerHTML = colorBoxHtml;
            }

        }
    }

    function renderEpics() {
      var html = "<div class='title'><span class='grey'>Status on Epics for Project:</span> {0} <span class='grey'>and Version:</span> {1}</div>".format(project, (version ? version : "None"));
      var epics = epicsModel.getAll();
      for (var key in epics) {
        var item = epics[key];
        var indentClass = (item.parent) ? "indent"+item.depth : "";
        //var parenthtml = (item.parent) ? "[{0}] -> ".format(item.parent) : "";
        html +=
            "<div class='jira-container " + indentClass + "'>" +
                "<div class='jira-status' id='" + item.key + "-status'>" +
                "   <div class='colorbox' title='no status for this Epic'>-</div>" +
                "</div>" +
                "<div class='jira-item'>" +
                    "<a target='_blank' href='" + item.link + "'>" + item.name + "</a>" +
                "</div>" +
            "</div>";
      }
      html += "<br/>";
      document.getElementById('content_div').innerHTML = html;
      gadgets.window.adjustHeight();
    }

    // ***********************************
    // model


    var epicsModel = {
        epics : {},
        remove : function(key) {
            delete this.epics[key];
        },
        get : function(key) {
            return this.epics[key];
        },
        create : function(key, name, link, parent, status) {
            var epic = {
                    key : key,
                    name : name,
                    link : link,
                    parent : parent,
                    status : status,
                    depth : 0,
                    factor:0
                };
            this.epics[key] = epic;
            return epic;
        },
        children : function(key) {
            var result = {}
            for(var childkey in this.epics) {
                var child = this.epics[childkey];
                if (child.parent == key) {
                    result[child.key] = child;
                }
            }
            return result;
        },
        hasChildren : function(key) {
            for(var childkey in this.epics) {
                var child = this.epics[childkey];
                if (child.parent == key) {
                    return true;
                }
            }
            return false;
        },
        sort : function() {
            var result = {};
            for (var key in this.epics) {
                var epic = this.epics[key];
                if (epic.parent == null) {
                    epic.depth = 1;
                    result[epic.key] = epic;
                    if (this.hasChildren(epic.key)) {
                        result = this.sortChildren(result, epic);
                    }
                }
            }
            this.epics = result;
        },
        sortChildren : function(result, epic) {
            for (var key in this.children(epic.key)) {
                var child = this.epics[key];
                child.depth = epic.depth+1;
                result[child.key] = child;
                if (this.hasChildren(child.key)) {
                    this.sortChildren(result, child);
                }
            }
            return result;
        } ,
        getAll : function() {
            return this.epics;
        },
        aggregateFactor : function() {
            for (var key in this.epics) {
                var epic = this.epics[key];
                if (epic.parent == null) {
                    if (this.hasChildren(epic.key)) {
                        epic.factor = this.aggregateChildren(epic.key);
                        this.epics[epic.key] = epic;
                    }
                }
            }
        },
        aggregateChildren : function(key) {
            var factor = 0;
            var cnt = 0;
            for (var key in this.children(key)) {
                var child = this.epics[key];
                if (this.hasChildren(key)) {
                    //branch
                    factor += this.aggregateChildren(key);
                    child.factor = factor;
                    this.epics[key] == factor;
                    cnt++;
                } else {
                    //leaf
                    if (child.factor) {
                        factor += child.factor;
                    }
                    cnt++;
                }
            }
            return factor/cnt;
        }
    };

    // ***********************************
    // utility methods


    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/\{(\d+)\}/g, function (m, n) { return args[n]; });
    };
})();