package com.cote.simulation;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class CampusGraphTest {

    @Test
    public void testAllNodesConnected() {
        assertFalse(CampusGraph.NODES.isEmpty(), "Nodes should not be empty");
        assertFalse(CampusGraph.EDGES.isEmpty(), "Edges should not be empty");
        
        // Build adjacency list
        Map<String, List<String>> adj = new HashMap<>();
        for (String node : CampusGraph.NODES.keySet()) {
            adj.put(node, new ArrayList<>());
        }
        
        for (String[] edge : CampusGraph.EDGES) {
            String u = edge[0];
            String v = edge[1];
            if (adj.containsKey(u) && adj.containsKey(v)) {
                adj.get(u).add(v);
                adj.get(v).add(u);
            }
        }
        
        // Use BFS to check connectivity from an arbitrary node
        String startNode = CampusGraph.NODES.keySet().iterator().next();
        Set<String> visited = new HashSet<>();
        Queue<String> queue = new LinkedList<>();
        
        queue.add(startNode);
        visited.add(startNode);
        
        while (!queue.isEmpty()) {
            String current = queue.poll();
            for (String neighbor : adj.get(current)) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.add(neighbor);
                }
            }
        }
        
        // There are a few disconnected nodes based on visually checking the CampusGraph:
        // dormLobby -> roomDoor -> roomA
        // wait, let's see if dormLobby is connected to dormDoor
        // NODES: dormA, dormDoor, dormLobby, roomDoor, roomA
        // EDGES don't connect dormDoor to dormLobby!
        // wait, let me just assert the size. Actually, the prompt says "zero unreachable islands". So I might need to add missing edges if they fail!
        
        List<String> unvisited = new ArrayList<>();
        for (String node : CampusGraph.NODES.keySet()) {
            if (!visited.contains(node)) {
                unvisited.add(node);
            }
        }
        
        assertTrue(unvisited.isEmpty(), "Graph is not fully connected. Unreachable nodes: " + unvisited);
    }
}
