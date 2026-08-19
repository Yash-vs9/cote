package com.cote.simulation;

import java.util.*;

public class RouteManager {
    private final Map<String, double[]> nodes;
    private final Map<String, List<String>> adjacency = new HashMap<>();
    private final TrafficManager trafficManager;

    public RouteManager(TrafficManager tm) {
        this.nodes = CampusGraph.NODES;
        this.trafficManager = tm;
        for (String k : nodes.keySet()) adjacency.put(k, new ArrayList<>());
        for (String[] e : CampusGraph.EDGES) {
            if (adjacency.containsKey(e[0]) && adjacency.containsKey(e[1])) {
                adjacency.get(e[0]).add(e[1]);
                adjacency.get(e[1]).add(e[0]);
            }
        }
    }

    public List<List<String>> findCandidateRoutes(String from, String to) {
        List<List<String>> candidates = new ArrayList<>();
        if (from.equals(to)) {
            candidates.add(Collections.singletonList(from));
            return candidates;
        }

        List<String> p1 = shortestPath(from, to, Collections.emptySet());
        if (p1 != null) candidates.add(p1);

        if (p1 != null && p1.size() > 2) {
            for (int i = 1; i < p1.size() - 1; i++) {
                String bannedEdge = TrafficManager.edgeKey(p1.get(i), p1.get(i + 1));
                List<String> pAlt = shortestPath(from, to, Collections.singleton(bannedEdge));
                if (pAlt != null && !containsPath(candidates, pAlt)) {
                    candidates.add(pAlt);
                    if (candidates.size() >= 4) break;
                }
            }
        }
        return candidates.isEmpty() ? Collections.singletonList(Arrays.asList(from, to)) : candidates;
    }

    private boolean containsPath(List<List<String>> candidates, List<String> target) {
        for (List<String> c : candidates) {
            if (c.equals(target)) return true;
        }
        return false;
    }

    private List<String> shortestPath(String from, String to, Set<String> bannedEdges) {
        Queue<List<String>> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();
        queue.add(Collections.singletonList(from));

        while (!queue.isEmpty()) {
            List<String> path = queue.poll();
            String cur = path.get(path.size() - 1);
            if (cur.equals(to)) return path;
            if (visited.contains(cur) && path.size() > 6) continue;
            visited.add(cur);

            for (String neighbor : adjacency.getOrDefault(cur, Collections.emptyList())) {
                if (path.contains(neighbor)) continue;
                String ek = TrafficManager.edgeKey(cur, neighbor);
                if (bannedEdges.contains(ek)) continue;
                List<String> nextPath = new ArrayList<>(path);
                nextPath.add(neighbor);
                queue.add(nextPath);
            }
        }
        return null;
    }

    public double pathDistance(List<String> nodeKeys) {
        double d = 0;
        for (int i = 0; i < nodeKeys.size() - 1; i++) {
            double[] a = nodes.get(nodeKeys.get(i));
            double[] b = nodes.get(nodeKeys.get(i + 1));
            if (a != null && b != null) {
                d += Math.hypot(a[0] - b[0], a[1] - b[1]);
            }
        }
        return d;
    }

    public static class RouteSelectionResult {
        public final List<String> route;
        public final String routeId;
        public final List<List<String>> allCandidates;

        public RouteSelectionResult(List<String> route, String routeId, List<List<String>> allCandidates) {
            this.route = route;
            this.routeId = routeId;
            this.allCandidates = allCandidates;
        }
    }

    public RouteSelectionResult selectBestRoute(String fromNode, String toNode, String npcId) {
        List<List<String>> candidates = findCandidateRoutes(fromNode, toNode);
        if (candidates.size() == 1) {
            return new RouteSelectionResult(candidates.get(0), "ROUTE_PRIMARY_DIRECT", candidates);
        }

        double bestScore = Double.MAX_VALUE;
        List<String> bestRoute = candidates.get(0);
        int bestIdx = 0;

        int hash = Math.abs((npcId == null ? "npc" : npcId).hashCode());
        double seedOffset = ((hash % 5) - 2) * 1.6;

        for (int i = 0; i < candidates.size(); i++) {
            List<String> cand = candidates.get(i);
            double dist = pathDistance(cand);
            double traffic = trafficManager.getRouteTrafficCost(cand);
            double score = dist + traffic + (i == (hash % candidates.size()) ? -2.2 : seedOffset);

            if (score < bestScore) {
                bestScore = score;
                bestRoute = cand;
                bestIdx = i;
            }
        }

        char routeLetter = (char) ('A' + bestIdx);
        String routeId = String.format("ROUTE_%c_%dND", routeLetter, bestRoute.size());
        return new RouteSelectionResult(bestRoute, routeId, candidates);
    }
}
