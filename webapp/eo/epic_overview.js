var msg = new gadgets.MiniMessage();
var loadMessage = msg.createStaticMessage("loading...");

var prefs = new gadgets.Prefs();
var project = prefs.getString("project");
var version = prefs.getString("version");

gadgets.util.registerOnLoadHandler(fetchIssues);

function fetchIssues() {
    gadgets.window.adjustHeight();
    if (!project) {
        document.getElementById('content_div').innerHTML = "Please configure project and optionally version";
        msg.dismissMessage(loadMessage);
        gadgets.window.adjustHeight();
    }  else {
        var jqlQuery = "project%3D" + encodeURIComponent(project) + "+AND+Type%3DEpic";
        if (version) {
            jqlQuery = "project%3D" + encodeURIComponent(project) + "+AND+Type%3DEpic+AND+fixVersion=%22" + encodeURIComponent(version) + "%22";
        }

        var url = "http://jira.global.sdl.corp:8080/jira/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=" + jqlQuery;

        var params = {};
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;

        gadgets.io.makeRequest(url, handleResponse, params);
    }
}

function handleResponse(obj) {
    var domData = obj.data;

    var jiraIssues = {
        title : "<span class='grey'>Status on Epics for Project:</span> " + project + " <span class='grey'>and Version:</span> " + (version ? version : "None"),
        items : getEpics(domData)
    };

    renderJiraIssues(jiraIssues);
    renderStatuses(jiraIssues);

    gadgets.window.adjustHeight();
}

function renderStatuses(jiraIssues) {
    for (var i = 0; i < jiraIssues.items.length;i++) {
        var item = jiraIssues.items[i];
        getItemStatus(item.key);
    }
}

function getEpics(domData) {
  var items = [];
  var itemNodes = domData.getElementsByTagName("item");

  for (var i = 0; i < itemNodes.length; i++) {
    var item = {};

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
        case "updated":
          item.date = childNode.firstChild.nodeValue;
          break;
      }
    }

    items.push(item);
  }
  return items;
}

function isElement(node) {
  return node.nodeType == 1;
}

function getItemStatus(key){

    var url = "http://jira.global.sdl.corp:8080/jira/sr/" +
        "jira.issueviews:searchrequest-xml" +
        "/temp/SearchRequest.xml?" +
        "jqlQuery='Epic/Theme'=" + key + "&tempMax=100";
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
        total:0
    };
    var epic_key = "";
    var found_epic = false;

   var itemNodes = domData.getElementsByTagName("item");

    status.total = itemNodes.length;
    for (var i = 0; i < itemNodes.length; i++) {
        var childNodes = itemNodes.item(i).childNodes;
        var item= {
            original:0,
            remaining:0
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
                    if (found_epic) {break;}
                    var customFieldNodes = childNode.childNodes;
                    for (var k=0; k < customFieldNodes.length;k++) {
                        var customFieldNode = customFieldNodes.item(k);
                        if (!isElement(customFieldNode)) {continue;}
                        if (customFieldNode.getAttribute("id") == "customfield_10011") {
                            epic_key = customFieldNode.getElementsByTagName("label")[0].firstChild.nodeValue;
                            found_epic = true;
                        }
                    }
                    break;
            }
            status.original += item.original;
            status.remaining += item.remaining;


        }
        if (item.status != "Closed") {
            status.open += 1;
        } else {
            status.closed += 1;
        }

    }

    var statusHtml = status.open + "/" + status.closed + "/" + status.total + " Stories (Open/Closed/Total) | " + (status.remaining/3600) + "h /" + (status.original/3600) + "h Hours (Remaining/Total)";

    var colorBoxHtml = "<div title='"+ statusHtml +"' class='colorbox' style='background-color:" + calculateColor(status)+";'>" + Math.round(calculateStatusPer(status)*100) + "%</div>";

    if (document.getElementById(epic_key + "-status"))     {
        document.getElementById(epic_key + "-status").innerHTML = colorBoxHtml;
    }

    msg.dismissMessage(loadMessage);
    gadgets.window.adjustHeight();
}

function calculateStatusPer(status) {
    var factorHours = 0;
    if (status.original != 0) {
        factorHours = ((status.original - status.remaining) / status.original);
    }
    var factorStories = 0;
    if (status.total != 0) {
        factorStories = (status.closed / status.total);
    }

    return ((factorHours + factorStories) /2);
}

function calculateColor(status) {
    var color = "#FFFF00";
    var factor = calculateStatusPer(status);
    if (factor > 0.5) {
        color = "#" + toHex(512-factor*512) + "FF00";
    }
    if (factor < 0.5) {
        color =  "#FF" + toHex(factor*512) + "00";
    }
    return color;
}

function toHex(nr) {
    var hex = Math.round(nr).toString(16);
    if (hex.length==1) {
        hex = "0"+hex;
    }
    return hex;
}

function renderJiraIssues(jiraIssues) {
  var html = "<div class='title'>" + jiraIssues.title + "</div>";
  for (var i = 0; i < jiraIssues.items.length; i++) {
    var item = jiraIssues.items[i];
    html +=
        "<div class='jira-container'>" +
            "<div class='jira-status' id='" + item.key + "-status'>" +
            "   <div class='colorbox' title='no stories to this Epic'>-</div>" +
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
