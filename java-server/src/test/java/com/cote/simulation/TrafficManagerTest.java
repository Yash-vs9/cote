package com.cote.simulation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class TrafficManagerTest {

    private TrafficManager trafficManager;

    @BeforeEach
    public void setup() {
        trafficManager = new TrafficManager();
    }

    @Test
    public void testAddAndRemoveTraffic() {
        List<String> route = Arrays.asList("hub", "plazaN", "northA");
        
        // Add traffic
        trafficManager.addRouteTraffic("npc1", route);
        
        // Cost should be 7.5 per edge, and we have 2 edges in the route
        // Wait, getRouteTrafficCost gives the sum of edge costs. For the same route, it should be 7.5 * 2 = 15.0
        double cost = trafficManager.getRouteTrafficCost(route);
        assertEquals(15.0, cost, 0.01, "Adding traffic should increment cost by 7.5 per edge");
        
        // Remove traffic
        trafficManager.removeRouteTraffic("npc1", route);
        
        cost = trafficManager.getRouteTrafficCost(route);
        assertEquals(0.0, cost, 0.01, "Removing traffic should decrement edge loads back to 0");
    }
}
