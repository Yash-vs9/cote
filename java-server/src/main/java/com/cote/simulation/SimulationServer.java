package com.cote.simulation;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

public class SimulationServer {
    private static final int DEFAULT_PORT = 8080;
    private final SimulationEngine engine;
    private final HttpServer server;

    public SimulationServer(int port) throws IOException {
        this.engine = new SimulationEngine();

        this.server = HttpServer.create(new InetSocketAddress(port), 0);
        this.server.setExecutor(Executors.newCachedThreadPool());

        // Background simulation loop (20 ticks/sec)
        Thread loopThread = new Thread(() -> {
            long lastTime = System.currentTimeMillis();
            while (true) {
                try {
                    long now = System.currentTimeMillis();
                    double dt = (now - lastTime) / 1000.0;
                    lastTime = now;
                    engine.tick(dt);
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        loopThread.setDaemon(true);
        loopThread.start();

        setupRoutes();
    }

    private void setupRoutes() {
        // The old web portal was removed with the desktop migration; serve a small
        // API index instead of a working-directory-dependent static file tree.
        server.createContext("/", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                sendJson(exchange, "{\"server\":\"COTE Java Simulation Engine\",\"version\":\"2.0\","
                        + "\"endpoints\":[\"/api/health\",\"/api/simulation\",\"/api/route\",\"/api/time\"]}");
            }
        });

        server.createContext("/api/health", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                sendJson(exchange, "{\"status\":\"OK\",\"server\":\"COTE Java Simulation Engine\",\"version\":\"2.0\"}");
            }
        });

        server.createContext("/api/simulation", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                StringBuilder sb = new StringBuilder();
                sb.append("{");
                sb.append("\"time\":\"").append(engine.getFormattedTime()).append("\",");
                sb.append("\"clockMin\":").append(String.format("%.2f", engine.getClockMin())).append(",");
                sb.append("\"day\":").append(engine.getDay()).append(",");
                ScheduleEvent evt = engine.getCurrentEvent();
                sb.append("\"event\":").append(evt == null ? "null" : evt.toJson()).append(",");

                sb.append("\"npcs\":[");
                List<NPC> npcs = engine.getNpcs();
                for (int i = 0; i < npcs.size(); i++) {
                    sb.append(npcs.get(i).toJson());
                    if (i < npcs.size() - 1) sb.append(",");
                }
                sb.append("]");
                sb.append("}");

                sendJson(exchange, sb.toString());
            }
        });

        server.createContext("/api/route", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String query = exchange.getRequestURI().getQuery();
                Map<String, String> params = parseQuery(query);
                String from = params.getOrDefault("from", "gateN");
                String to = params.getOrDefault("to", "classroom");
                String npcId = params.getOrDefault("npcId", "student");

                RouteManager.RouteSelectionResult res = engine.getRouteManager().selectBestRoute(from, to, npcId);

                StringBuilder sb = new StringBuilder();
                sb.append("{");
                sb.append("\"from\":\"").append(from).append("\",");
                sb.append("\"to\":\"").append(to).append("\",");
                sb.append("\"routeId\":\"").append(res.routeId).append("\",");
                sb.append("\"route\":[");
                for (int i = 0; i < res.route.size(); i++) {
                    sb.append("\"").append(res.route.get(i)).append("\"");
                    if (i < res.route.size() - 1) sb.append(",");
                }
                sb.append("],");
                sb.append("\"candidateCount\":").append(res.allCandidates.size());
                sb.append("}");

                sendJson(exchange, sb.toString());
            }
        });

        server.createContext("/api/time", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String query = exchange.getRequestURI().getQuery();
                Map<String, String> params = parseQuery(query);
                if (params.containsKey("hour")) {
                    try {
                        double h = Double.parseDouble(params.get("hour"));
                        engine.setClockMin(h * 60.0);
                    } catch (NumberFormatException ignored) {}
                }
                sendJson(exchange, "{\"success\":true,\"time\":\"" + engine.getFormattedTime() + "\"}");
            }
        });
    }

    private static Map<String, String> parseQuery(String query) {
        Map<String, String> map = new java.util.HashMap<>();
        if (query == null || query.isEmpty()) return map;
        for (String param : query.split("&")) {
            String[] pair = param.split("=");
            if (pair.length > 1) map.put(pair[0], pair[1]);
            else map.put(pair[0], "");
        }
        return map;
    }

    private static void sendJson(HttpExchange exchange, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }

        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    public void start() {
        server.start();
        System.out.println("=================================================");
        System.out.println("🚀 COTE Java Simulation Server Started on port " + server.getAddress().getPort());
        System.out.println("   Health check: http://localhost:" + server.getAddress().getPort() + "/api/health");
        System.out.println("   Live Sim API: http://localhost:" + server.getAddress().getPort() + "/api/simulation");
        System.out.println("   Route Solver: http://localhost:" + server.getAddress().getPort() + "/api/route?from=gateN&to=classroom");
        System.out.println("=================================================");
    }

    public static void main(String[] args) {
        try {
            int port = DEFAULT_PORT;
            for (String arg : args) {
                if (arg.startsWith("--")) continue; // legacy --headless flag: the server is always headless
                try { port = Integer.parseInt(arg); } catch (Exception ignored) {}
            }

            SimulationServer server = new SimulationServer(port);
            server.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
