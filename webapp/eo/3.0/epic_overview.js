(function($) {
    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var cnt = 0;

    var prefs = new gadgets.Prefs();
    var project = prefs.getString("project");
    var version = prefs.getString("version");

    var iconPath = "http://" + this.location.host + "/jira/images/icons";

    var baseSearchRequest = "http://" + this.location.host + "/jira/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=";
    var JqlQuery = {
        Epic                : "%22Epic/Theme%22%3D{0}+AND+Type%3DStory+ORDER+BY+Rank",
        Epics               : "project%3D%22{0}%22+AND+Type%3DEpic+ORDER+BY+Rank",
        EpicsForVersion     : "project%3D%22{0}%22+AND+Type%3DEpic+AND+fixVersion=%22{1}%22+ORDER+BY+Rank"
    };

    gadgets.util.registerOnLoadHandler(fetchIssues);

    function log(text) {
        if (console){console.log(text);}
    }

    function fetchIssues() {
        gadgets.window.adjustHeight();
        if (!project) {
            document.getElementById('content_div').innerHTML = "Please configure project and optionally version";
            msg.dismissMessage(loadMessage);
            gadgets.window.adjustHeight();
        }  else {
            gadgets.window.setTitle("Epic Overview - Project: {0} Version: {1}".format(project, version));

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
                    case "status":
                        item.state = childNode.firstChild.nodeValue;
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

            epicsModel.create(item.key, item.name, item.link, item.parent, item.state, null);
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
        log(url);
        gadgets.io.makeRequest(url, function(obj){
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
                            case "link":
                                item.link = childNode.firstChild.nodeValue;
                                break;
                            case "summary":
                                item.name = childNode.firstChild.nodeValue;
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
                                    /*if (customFieldNode.getAttribute("id") == "customfield_10011") {
                                        var labels = customFieldNode.getElementsByTagName("label");
                                        for (var l=0;l<labels.length;l++) {
                                            epic_keys.push(label);
                                        }
                                    } */
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


                    storyModel.create(item.key, key, item.name, item.link, item.status, item.storypoints);

                    if (epicsModel.get(key)) {
                        var epic = epicsModel.epics[key];
                        epic.status = status;
                        epic.factor = calculateStatusPer(status);
                        epic.stories = storyModel.getStoriesForEpic(key);
                        epicsModel.epics[key] = epic;

                    }

                }


                var statusHtml = status.open + "/" + status.closed + "/" + status.total + " Stories (Open/Closed/Total)|" + status.openStorypoints + "/" + status.closedStorypoints + " SP (Open/Closed) | " + (status.remaining/3600) + "h /" + (status.original/3600) + "h Hours (Remaining/Total)";

                var factor =  calculateStatusPer(status);

                var colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(factor)+";'>" + Math.round(factor*100) + "%</div>";

                if (document.getElementById(key + "-status"))     {
                    document.getElementById(key + "-status").innerHTML = colorBoxHtml;
                }

                if (epicsModel.get(key)) {
                    var storyHtml = getStoriesHtmlForEpic(epicsModel.get(key));

                    if (document.getElementById(key + "-stories")) {
                        document.getElementById(key + "-stories").innerHTML = storyHtml;
                    }
                }

                msg.dismissMessage(loadMessage);
                gadgets.window.adjustHeight();
            }
            , params);
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
        // hours and stories are weighted 1 : 8 (storypoint as an ideal day)
        return ((factorHours + (factorStories*8)) /9);
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
            var colorBoxHtml;

            if (!item.status || item.status.total == 0) {
                colorBoxHtml = "<div title='no stories for this epic' class='colorbox alert'></div>";
            } else {
                colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(item.factor)+";'>" + Math.round(item.factor*100) + "%</div>";
            }

//            var colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(item.factor)+";'>" + Math.round(item.factor*100) + "%</div>";

            if (document.getElementById(key + "-status")) {
                document.getElementById(key + "-status").innerHTML = colorBoxHtml;
            }
        }

        $('.toggle').click(function() {
            $(this).siblings('.stories').toggle();
            gadgets.window.adjustHeight();
        });
    }

    function renderEpics() {
      //var html = "<div class='title'><span class='grey'>Status on Epics for Project:</span> {0} <span class='grey'>and Version:</span> {1}</div>".format(project, (version ? version : "None"));
      var html="";

      var epics = epicsModel.getAll();
      var cnt = 0;
      for (var key in epics) {
        var item = epics[key];
        var indentClass = (item.parent) ? "indent"+item.depth : "";
        var epicCloseClass = item.state == "Closed" ? "striked" : "";
        html +=
            "<div id='" + item.key + "' class='jira-container " + indentClass + "'>" +
                "<div class='toggle rightarrow'></div>" +
                "<div class='jira-status' id='" + item.key + "-status'>" +
                "   <div class='colorbox' title='no status for this Epic'>-</div>" +
                "</div>" +
                "<div class='jira-item "+epicCloseClass+"'>" +
                    "<a target='_blank' href='" + item.link + "'>" + item.name + "</a>" +
                "</div>" +
                "<div id='" + item.key + "-stories' class='stories'>no stories</div>" +
            "</div>";
          cnt = cnt + 1;
      }
        html += "<div class='jira-container'><div class='footer'>{0} epics</div><div class='stories'><br/><br/><br/></div></div>".format(cnt);
        document.getElementById('content_div').innerHTML = html;

      gadgets.window.adjustHeight();
    }

    function getStoriesHtmlForEpic(epic) {
        var html = "";
        var stories = epic.stories;
        for (var key in stories) {
            var story = stories[key];
            var formatclass = (story.status == 'Closed') ? "striked" : "";
            var alertclass = (story.storyPoints == 0) ? "alert" : "";

            html += "<div class='story {0} {1}'><a target='_blank' href='{2}'>[{3}] {4}</a> ({5} SP)</div>"
                .format(formatclass, alertclass, story.link, story.key, story.name, story.storyPoints);
        }
        return html;
    }


    // ***********************************
    // model

    var storyModel = {
        stories : {},
        create : function(key, epic, name, link, status, storyPoints) {
            var story = {
                key : key,
                epic : epic,
                name : name,
                link : link,
                status : status,
                storyPoints : storyPoints
            };
            this.stories[key] = story;
            return story;
        },
        remove : function(key) {
            delete this.stories[key];
        },
        get : function(key) {
            return this.stories[key];
        },
        getAll : function() {
            return this.stories;
        },
        getStoriesForEpic : function(epicKey) {
            var result = {};
            for (var key in this.stories) {
                var story = this.stories[key];
                if (story.epic == epicKey) {
                    result[key] = story;
                }
            }
            return result;
        }

    };

    var epicsModel = {
        epics : {},
        remove : function(key) {
            delete this.epics[key];
        },
        get : function(key) {
            return this.epics[key];
        },
        create : function(key, name, link, parent, state, status) {
            var epic = {
                    key : key,
                    name : name,
                    link : link,
                    parent : parent,
                    state : state,
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
})($);
