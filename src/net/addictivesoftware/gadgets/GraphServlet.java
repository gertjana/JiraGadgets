package net.addictivesoftware.gadgets;

import org.codehaus.jackson.JsonFactory;
import org.codehaus.jackson.JsonNode;
import org.codehaus.jackson.JsonParser;
import org.codehaus.jackson.map.ObjectMapper;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Hello world!
 *
 */
public class GraphServlet extends HttpServlet
{
    public void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException
    {
        String graphType = req.getParameter("type");
        String data = req.getParameter("data");

        if (graphType == null || data == null) {
            resp.getWriter().println("Please provide graph type and data");
            return;
        }

        if (graphType.equals("velocity")) {
            doVelocityGraph(data);
        }

    }

    private void doVelocityGraph(String data) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        JsonFactory factory = mapper.getJsonFactory();
        JsonParser jp = factory.createJsonParser("{\"k1\":\"v1\"}");
        JsonNode dataNode = mapper.readTree(jp);

        String name = dataNode.findValue("name").asText();
        String releasedate = dataNode.findValue("date").asText();

        JsonNode sprintsNode = dataNode.findValue("sprints");

        List<Sprint> sprints = new ArrayList<Sprint>();

        Iterator<JsonNode> sprintNodes = sprintsNode.getElements();
        while (sprintNodes.hasNext()) {
            JsonNode sprint = sprintNodes.next();
            sprints.add(new Sprint(
                    sprint.get(0).asText(),
                    sprint.get(1).asText(),
                    sprint.get(2).asText()
            ));
        }
    }


    protected class Sprint {
        protected String name;
        protected String velocity;
        protected String releaseDate;

        protected Sprint(String _name, String _velocity, String _releaseDate) {
            name = _name;
            velocity = _velocity;
            releaseDate = _releaseDate;
        }
    }
}
