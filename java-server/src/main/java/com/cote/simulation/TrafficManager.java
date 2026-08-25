package com.cote.simulation;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TrafficManager {
    private final Map<String, Integer> edgeTraffic = new HashMap<>();
    private final Map<String, Integer> nodeTraffic = new HashMap<>();

    public static String edgeKey(String a, String b) {
        return a.compareTo(b) < 0 ? a + "---" + b : b + "---" + a;
    }

    public synchronized void addRouteTraffic(String npcId, List<String> nodeKeys) {
        if (nodeKeys == null || nodeKeys.isEmpty()) return;
        for (int i = 0; i < nodeKeys.size(); i++) {
            String n = nodeKeys.get(i);
            nodeTraffic.put(n, nodeTraffic.getOrDefault(n, 0) + 1);
            if (i < nodeKeys.size() - 1) {
                String ek = edgeKey(nodeKeys.get(i), nodeKeys.get(i + 1));
                edgeTraffic.put(ek, edgeTraffic.getOrDefault(ek, 0) + 1);
            }
        }
    }

    public synchronized void removeRouteTraffic(String npcId, List<String> nodeKeys) {
        if (nodeKeys == null || nodeKeys.isEmpty()) return;
        for (int i = 0; i < nodeKeys.size(); i++) {
            String n = nodeKeys.get(i);
            nodeTraffic.put(n, Math.max(0, nodeTraffic.getOrDefault(n, 0) - 1));
            if (i < nodeKeys.size() - 1) {
                String ek = edgeKey(nodeKeys.get(i), nodeKeys.get(i + 1));
                edgeTraffic.put(ek, Math.max(0, edgeTraffic.getOrDefault(ek, 0) - 1));
            }
        }
    }

    public synchronized void replaceRouteTraffic(String npcId, List<String> oldNodes, List<String> newNodes) {
        if (oldNodes != null && oldNodes.equals(newNodes)) return;
        removeRouteTraffic(npcId, oldNodes);
        addRouteTraffic(npcId, newNodes);
    }

    public synchronized double getRouteTrafficCost(List<String> nodeKeys) {
        if (nodeKeys == null || nodeKeys.size() < 2) return 0.0;
        double cost = 0.0;
        for (int i = 0; i < nodeKeys.size() - 1; i++) {
            String ek = edgeKey(nodeKeys.get(i), nodeKeys.get(i + 1));
            cost += edgeTraffic.getOrDefault(ek, 0) * 7.5; // 7.5m equivalent distance cost per other student
        }
        return cost;
    }

    public synchronized Map<String, Integer> getEdgeTrafficSnapshot() {
        return new HashMap<>(edgeTraffic);
    }
}
