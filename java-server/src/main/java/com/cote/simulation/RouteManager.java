package com.cote.simulation;

import java.util.*;

public class RouteManager {
    private final Map<String, double[]> nodes;
    private final Map<String, List<String>> adjacency = new HashMap<>();
    private final TrafficManager trafficManager;
    private final Map<String, List<String>> activeRoutes = new HashMap<>();

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

    /** Dijkstra over real edge distances; returns null when the target is unreachable. */
    private List<String> shortestPath(String from, String to, Set<String> bannedEdges) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        Set<String> settled = new HashSet<>();
        PriorityQueue<String> frontier =
                new PriorityQueue<>(Comparator.comparingDouble(dist::get));
        dist.put(from, 0.0);
        frontier.add(from);

        while (!frontier.isEmpty()) {
            String cur = frontier.poll();
            if (!settled.add(cur)) continue;
            if (cur.equals(to)) break;
            double dCur = dist.get(cur);
            for (String neighbor : adjacency.getOrDefault(cur, Collections.emptyList())) {
                String ek = TrafficManager.edgeKey(cur, neighbor);
                if (bannedEdges.contains(ek)) continue;
                double nd = dCur + segmentDistance(cur, neighbor);
                if (nd < dist.getOrDefault(neighbor, Double.MAX_VALUE)) {
                    dist.put(neighbor, nd);
                    prev.put(neighbor, cur);
                    frontier.add(neighbor);
                }
            }
        }

        if (!dist.containsKey(to)) return null;
        LinkedList<String> path = new LinkedList<>();
        for (String at = to; at != null; at = prev.get(at)) path.addFirst(at);
        return path;
    }

    private double segmentDistance(String a, String b) {
        double[] pa = nodes.get(a);
        double[] pb = nodes.get(b);
        return (pa == null || pb == null) ? 0 : Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    }

    public double pathDistance(List<String> nodeKeys) {
        double d = 0;
        for (int i = 0; i < nodeKeys.size() - 1; i++) {
            d += segmentDistance(nodeKeys.get(i), nodeKeys.get(i + 1));
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
        String key = npcId == null ? "npc" : npcId;
        List<String> chosen;
        String routeId;

        if (candidates.size() == 1) {
            chosen = candidates.get(0);
            routeId = "ROUTE_PRIMARY_DIRECT";
        } else {
            double bestScore = Double.MAX_VALUE;
            List<String> bestRoute = candidates.get(0);
            int bestIdx = 0;

            int hash = Math.abs(key.hashCode());
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
            routeId = String.format("ROUTE_%c_%dND", routeLetter, bestRoute.size());
            chosen = bestRoute;
        }

        // Live traffic bookkeeping: free the NPC's previous edges, load the new ones, so
        // repeat selections spread across alternate routes.
        List<String> previous = activeRoutes.put(key, chosen);
        trafficManager.replaceRouteTraffic(npcId, previous, chosen);
        return new RouteSelectionResult(chosen, routeId, candidates);
    }
}
