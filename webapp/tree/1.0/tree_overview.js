(function($, d3) {
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

    var msg = new gadgets.MiniMessage();
    var loadMessage = msg.createStaticMessage("loading...");

    var prefs = new gadgets.Prefs();
    var project = prefs.getString("project");
    var version = prefs.getString("version");
    var showSubTasks = prefs.getBool("showSubTasks");

    var baseSearchRequest = "http://" + this.location.host + "/jira/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=";
    var baseIssueRequest  = "http://" + this.location.host + "/jira/secure/IssueNavigator.jspa?reset=true&jqlQuery=";
    var singleIssueRequest = "http://" + this.location.host + "/jira/browse/{0}";

    var JqlQuery = {
        StoriesForAProject                : "Project%3D%22{0}%22+AND+(issueType%3DStory+OR+issueType%3DEpic)+AND+Status!%3DClosed",
        StoriesForAProjectAndVersion      : "Project%3D%22{0}%22+AND+(issueType%3DStory+OR+issueType%3DEpic)+AND+Status!%3DClosed+AND+fixVersion%3D%22{1}%22",
        SingleIssue                       : "key%3D%22{0}%22"
    };

    var data = {
        nodes:[],
        links:[]
    };

    var TypeColors = {
        Story : "#2ca02c",
        Epic : "#1f77b4",
        SubTask : "#c49c94",
        Link : "#ff7f0e"
    }

    var nodesToUpdate = [];

    var w = gadgets.window.getViewportDimensions().width,
        h = parseInt(gadgets.window.getViewportDimensions().width *.66);

    var vis = d3.select("#content_div").append("svg:svg")
        .attr("width", w)
        .attr("height", h);

    var force;
    gadgets.util.registerOnLoadHandler(fetchIssues);

    function fetchIssues() {
        $('#content_div').css("height",h);
        gadgets.window.adjustHeight();
        if (!project) {
            document.getElementById('content_div').innerHTML = "Please configure project and optionally version";
            msg.dismissMessage(loadMessage);
            gadgets.window.adjustHeight();
        }  else {
            gadgets.window.setTitle("Hierarchical View - Project: {0} Version: {1}".format(project, version));
            var jqlQuery = JqlQuery.StoriesForAProject.format(encodeURIComponent(project));
            if (version) {
                jqlQuery = JqlQuery.StoriesForAProjectAndVersion.format(encodeURIComponent(project), encodeURIComponent(version));
            }
            var url = baseSearchRequest + jqlQuery;
            var params = {};
            params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;

            log(url);
            gadgets.io.makeRequest(url, handleResponse, params);
        }
    }

    function handleResponse(obj) {
        if (obj.rc > 399) {
            document.getElementById('content_div').innerHTML = obj.text;
            return;
        }

        var domData = obj.data;
        var items = [];

        var itemNodes = domData.getElementsByTagName("item");
        for (var i = 0; i < itemNodes.length; i++) {
            var childNodes = itemNodes.item(i).childNodes;
            var item= {

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
                    case "title":
                        item.name = childNode.firstChild.nodeValue;
                        break;
                    case "type":
                        item.type = childNode.firstChild.nodeValue;
                        break;
                    case "customfields":
                        var customFieldNodes = childNode.childNodes;
                        item.epic = [];
                        for (var k=0; k < customFieldNodes.length;k++) {
                            var customFieldNode = customFieldNodes.item(k);
                            if (!isElement(customFieldNode)) {continue;}
                            if (customFieldNode.getAttribute("id") == "customfield_10011") { // CustomField Epic/Theme
                                var labels = customFieldNode.getElementsByTagName("label");
                                for (var l=0;l<labels.length;l++) {
                                    item.epic.push(labels[l].firstChild.nodeValue);
                                }
                            }
                            if (customFieldNode.getAttribute("id") == "customfield_10013") { // Storypoints
                                item.storypoints = customFieldNode.getElementsByTagName("customfieldvalue")[0].firstChild.nodeValue;
                            }

                        }
                        break;
                    case "issuelinks":
                        var issueLinkNodes = childNode.childNodes;
                        var issueLinks = [];
                        for (var k=0;k<issueLinkNodes.length;k++){
                            var issueLink = {};
                            var issueLinkNode = issueLinkNodes.item(k);
                            if (!isElement(issueLinkNode)) {continue;}
                            issueLink.link = issueLinkNode.getElementsByTagName("issuekey")[0].firstChild.nodeValue;
                            issueLink.cause = issueLinkNode.getElementsByTagName("name")[0].firstChild.nodeValue;
                            issueLinks.push(issueLink);
                        }
                        item.links = issueLinks;
                        break;
                    case "subtasks":
                        if (showSubTasks) {
                            var subTaskNodes = childNode.childNodes;
                            var subTasks =[];
                            for (l=0;l<subTaskNodes.length;l++){
                                var subTaskNode = subTaskNodes.item(l);
                                if (!isElement(subTaskNode)) {continue;}
                                subTasks.push(subTaskNode.firstChild.nodeValue);
                            }
                            item.subtasks = subTasks;
                            break;
                        }
                }
            }
            items.push(item);
        }

        for (l=0;l<items.length;l++) {
            var item = items[l];
            var size = ""+getSize(item.storypoints);

            if (item.type=="Epic") {
                var epic = {"name": item.key, "color": TypeColors.Epic, "size":"10", "title":item.name};
                if (isInArray(epic.name, data.nodes)==-1) {
                    data.nodes.push(epic);
                }
            }  else {
                data.nodes.push({"name": item.key, "color": TypeColors.Story, "size":size, "title":item.name});
            }

            var itemId = data.nodes.length-1;
            if (item.epic) {
                for (var m=0;m<item.epic.length;m++) {
                    var epic = item.epic[m];
                    var epicId;
                    if (isInArray(epic, data.nodes)==-1) {
                        var epicNode = {name: epic, color: TypeColors.Epic, "size":"10", "title":item.epic };
                        data.nodes.push(epicNode);
                        epicId = data.nodes.length-1;
                        nodesToUpdate.push(epicNode);
                    } else {
                        epicId = isInArray(epic, data.nodes);
                    }
                    data.links.push({"source":itemId, "target":epicId, "value":"3"});
                }
            }
            if (item.subtasks) {
                for(i=0;i<item.subtasks.length;i++) {
                    var subTaskNode = {"name": item.subtasks[i], "color":TypeColors.SubTask, "size": "10", "title":item.subtasks[i]};
                    data.nodes.push(subTaskNode);
                    var subTaskNodeId = data.nodes.length-1;
                    data.links.push({"source":itemId, "target":subTaskNodeId, "value":"1"});
                    nodesToUpdate.push(subTaskNode);
                }
            }
            if (item.links) {
                for(i=0;i<item.links.length;i++) {
                    var link = item.links[i];
                    var linkId;
                    if (isInArray(link.link, data.nodes)==-1) {
                        data.nodes.push({"name":link.link, "color":TypeColors.Link, "size":"10", "title":"{2} {1} {0}".format(link.link, link.cause, item.key)});
                        linkId = data.nodes.length-1;
                    } else {
                        linkId = isInArray(link.link, data.nodes);
                    }
                    data.links.push({"source":itemId, "target":linkId, "value":"4", "cause":link.cause});
                }
            }
        }

        updateNodes(nodesToUpdate);

        force = d3.layout.force()
            .nodes(data.nodes)
            .links(data.links)
            .size([w, h])
            .linkDistance(function(d) {
                if(isNaN(d.value)) {return 20;}
                return 20*parseFloat(d.value);
            })
            .charge(showSubTasks ? -80 : -120)
            .start();

        var node = vis.selectAll("circle.node")
            .data(data.nodes)
            .enter().append("svg:circle")
            .attr("class", "node")
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; })
            .attr("r", function(d) {return d.size;})
            .style("fill", function(d, i) { return d.color; })
            .style("stroke", function(d, i) { return d3.rgb(d.color).darker(2); })
            .style("stroke-width", 1.5)
            .call(force.drag);

        var title = node.append("title")
            .text(function(d) {return d.title;});

        var text = vis.selectAll("circle.text")
            .data(data.nodes)
            .enter().insert("svg:text")
            .attr("dx", "0.35em")
            .attr("dy", "10")
            .attr("text-anchor", "middle")
            .style("font-size", ".5em")
            .style("font-weight", "bold")
            .text(function(d) {return d.name;});

        var link = vis.selectAll("line.link")
            .data(data.links)
            .enter().insert("svg:line", "circle.node")
            .attr("class", "link")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });


        node.on("click", function(e) {
            window.open(singleIssueRequest.format(e.name), "_blank");
        });

        force.on("tick", function(e) {
            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; }) ;

            node.attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });

            title.text(function(d) {return d.title;})

            text.attr("dx",function(d) {return d.x;})
                .attr("dy", function(d) {return d.y + 20;});
        });


        msg.dismissMessage(loadMessage);
    }

    function updateNodes(nodesToUpdate) {

        $.each(nodesToUpdate, function(index) {
            var epic = nodesToUpdate[index];
            var q = JqlQuery.SingleIssue.format(epic.name);
            var params = {};
            params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;
            var url = baseSearchRequest + q;

            gadgets.io.makeRequest(url, function(obj) {
                var domData = obj.data;
                var item= {};

                var itemNodes = domData.getElementsByTagName("item");
                for (var i = 0; i < itemNodes.length; i++) {
                    var childNodes = itemNodes.item(i).childNodes;
                    for (var j = 0; j < childNodes.length ; j++) {
                        var childNode = childNodes.item(j);
                        if (!isElement(childNode) || !childNode.firstChild) {
                            continue;
                        }
                        switch (childNode.nodeName) {
                            case "title":
                                item.title = childNode.firstChild.nodeValue;
                                break;
                            case "customfields":
                                var customFieldNodes = childNode.childNodes;
                                for (var k=0; k < customFieldNodes.length;k++) {
                                    var customFieldNode = customFieldNodes.item(k);
                                    if (!isElement(customFieldNode)) {continue;}
                                    if (customFieldNode.getAttribute("id") == "customfield_10011") { // CustomField Epic/Theme
                                        item.epic = customFieldNode.getElementsByTagName("label")[0].firstChild.nodeValue;
                                    }
                                }
                                break;

                        }
                    }
                }
                var i= isInArray(epic.name, data.nodes);
                epic.title = item.title;

                if (item.epic) {
                    var epicId;
                    if (isInArray(item.epic, data.nodes)==-1) {
                        var epicNode = {name: item.epic, color: TypeColors.Epic, "size":"10", "title":item.epic};
                        data.nodes.push(epicNode);
                        epicId = data.nodes.length-1;
                        nodesToUpdate.push(epicNode);
                    } else {
                        epicId = isInArray(item.epic, data.nodes);
                    }
                    data.links.push({"source":i, "target":epicId, "value":"3"});
                    log("Adding Parent Epic: {0}".format(item.epic));
                }
                data.nodes[i] = epic;
                force.start();
            }, params);
        });


    }
})(jQuery, d3);