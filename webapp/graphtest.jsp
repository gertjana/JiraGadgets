<!DOCTYPE HTML>

<html>
    <head>
        <title>Graph Test</title>
    </head>
    <body>
<%
    String type = "velocity";
    String data = "" +
        "{'graph': {\n" +
        "   'release': 'ST 2013',\n" +
        "   'date': '31-12-2013',\n" +
        "   'sprints': [\n" +
        "       {'Sprint 1': {'5', ''}},\n" +
        "       {'Sprint 2': {'7', ''}},\n" +
        "       {'Sprint 3': {'4', ''}}\n" +
        "       ]\n" +
        "   }\n" +
        "}\n";

    String url= String.format("/graph?type=%s&data=%s", type, data);
    out.println(data);
%>

    <a href="<%= url %>">Test graph</a>

    </body>
</html>

