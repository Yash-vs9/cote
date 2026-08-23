package com.cote.client;

import com.cote.simulation.CampusGraph;
import com.cote.simulation.NPC;
import com.cote.simulation.RouteManager;
import com.cote.simulation.SimulationEngine;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Drives NPC movement using the simulation's brain (schedule + personality +
 * RouteManager pathfinding), and adds vertical navigation so NPCs actually ride
 * the dormitory lift up to their OWN room and sleep there at night.
 *
 * Ground travel follows the CampusGraph. When an NPC's destination is their dorm
 * room (night), they walk to the dorm lift, ride it up to their floor, then walk
 * to their room. In the morning they ride back down and head out.
 */
public class NpcController {

    // Dorm lift sits at the dorm building centre; rooms are on the upper floors.
    private static final double DORM_X = -34, DORM_Z = 58;
    private static final double DORM_FH = 3.2;      // dorm floor height
    private static final double LIFT_SPEED = 4.0;   // m/s vertical

    // Phases of a journey.
    private static final int GROUND = 0, ASCEND = 1, ROOM = 2, DESCEND_WALK = 3, DESCEND = 4, ARRIVED = 5;

    private final SimulationEngine engine;
    private final RouteManager routes;

    private static class Nav {
        String currentNode;
        String destKey;         // what destinationFor() last returned
        List<String> route;
        int idx;
        double delayRemaining;
        double y;               // current vertical height
        int phase = GROUND;
        // resolved target
        boolean destIsDorm;
        String approachNode;
        double roomX, roomZ, roomY;
        // Player-issued action command (overrides the schedule until reached).
        String override;      // node key to route to
        String overrideName;  // place display name for the arrival report
    }

    private final Map<String, Nav> navs = new HashMap<>();
    private final Map<String, double[]> dormRoom = new HashMap<>(); // id -> {roomX, roomZ, roomY}
    private final Map<String, String> arrivalReports = new HashMap<>(); // id -> place name just reached

    public NpcController(SimulationEngine engine) {
        this.engine = engine;
        this.routes = engine.getRouteManager();
        // Assign each student a dorm room on floors 2..N (x cycles across 3 rooms).
        double[] roomXs = { -42, -34, -26 };
        int floor = 2;
        for (NPC npc : engine.getNpcs()) {
            Nav nav = new Nav();
            nav.currentNode = npc.getSpawnLoc();
            navs.put(npc.getId(), nav);
            if (!"teacher".equals(npc.getRole())) {
                double rx = roomXs[(floor) % roomXs.length];
                dormRoom.put(npc.getId(), new double[]{ rx, 50.0, floor * DORM_FH });
                floor++;
            }
        }
    }

    /** Vertical height of an NPC (for the client to render at the right floor). */
    public float getY(String id) {
        Nav n = navs.get(id);
        return n == null ? 0f : (float) n.y;
    }

    /** Action-chat: send an NPC to a place now (overrides its schedule until it arrives). */
    public void command(String npcId, String navNode, String placeName) {
        Nav n = navs.get(npcId);
        if (n == null || navNode == null) return;
        n.override = navNode;
        n.overrideName = placeName;
        n.destKey = null; // force an immediate re-plan
    }

    /** Returns (and clears) the place an NPC just finished walking to on command, or null. */
    public String pollArrival(String npcId) {
        return arrivalReports.remove(npcId);
    }

    /** True while the NPC is up in their dorm room (used for the knock-to-enter gate). */
    public boolean isHomeAsleep(String id) {
        Nav n = navs.get(id);
        return n != null && n.destIsDorm && n.phase == ARRIVED && n.y > 1.0;
    }

    public void update(float tpf) {
        for (NPC npc : engine.getNpcs()) {
            Nav nav = navs.get(npc.getId());
            if (nav == null) continue;

            // A player command overrides the schedule; otherwise follow the daily routine.
            String desired = (nav.override != null) ? nav.override : destinationFor(npc);
            if (desired == null) continue;

            if (!desired.equals(nav.destKey)) {
                nav.destKey = desired;
                resolveTarget(npc, nav, desired);
                // Commands respond immediately; scheduled moves keep their staggered delay.
                nav.delayRemaining = (nav.override != null) ? 0.0 : Math.max(0.0, npc.getDepartureDelay());
                if (nav.y > 0.5) {
                    nav.phase = DESCEND_WALK;
                } else {
                    beginGroundRoute(npc, nav);
                }
            }

            if (nav.delayRemaining > 0) { nav.delayRemaining -= tpf; continue; }

            switch (nav.phase) {
                case DESCEND_WALK: stepDescendWalk(npc, nav, tpf); break;
                case DESCEND:      stepDescend(npc, nav, tpf); break;
                case GROUND:       stepGround(npc, nav, tpf); break;
                case ASCEND:       stepAscend(npc, nav, tpf); break;
                case ROOM:         stepRoom(npc, nav, tpf); break;
                default: /* ARRIVED: idle */ break;
            }

            // Finished a commanded errand -> report it and hand control back to the schedule.
            if (nav.override != null && nav.phase == ARRIVED) {
                arrivalReports.put(npc.getId(), nav.overrideName);
                npc.setCurrentActivity("just arrived at " + nav.overrideName + " as you asked");
                nav.override = null;
                nav.overrideName = null;
                nav.destKey = null;
            }
        }
    }

    private void resolveTarget(NPC npc, Nav nav, String desired) {
        if ("DORMROOM".equals(desired) && dormRoom.containsKey(npc.getId())) {
            double[] r = dormRoom.get(npc.getId());
            nav.destIsDorm = true;
            nav.approachNode = "dorm";
            nav.roomX = r[0]; nav.roomZ = r[1]; nav.roomY = r[2];
        } else {
            nav.destIsDorm = false;
            nav.approachNode = "DORMROOM".equals(desired) ? "dorm" : desired;
            double[] c = CampusGraph.NODES.get(nav.approachNode);
            nav.roomX = c != null ? c[0] : npc.getX();
            nav.roomZ = c != null ? c[1] : npc.getZ();
            nav.roomY = 0;
        }
    }

    private void beginGroundRoute(NPC npc, Nav nav) {
        RouteManager.RouteSelectionResult res =
                routes.selectBestRoute(nav.currentNode, nav.approachNode, npc.getId());
        nav.route = res.route;
        nav.idx = (nav.route != null && nav.route.size() > 1) ? 1 : 0;
        npc.setRouteId(res.routeId);
        nav.phase = GROUND;
    }

    private void stepGround(NPC npc, Nav nav, float tpf) {
        if (nav.route == null || nav.idx >= nav.route.size()) {
            nav.phase = nav.destIsDorm ? ASCEND : ARRIVED;
            return;
        }
        double[] target = CampusGraph.NODES.get(nav.route.get(nav.idx));
        if (target == null) { nav.idx++; return; }
        if (moveXZ(npc, target[0], target[1], tpf)) {
            nav.currentNode = nav.route.get(nav.idx);
            npc.setCurrentSpot(nav.currentNode);
            nav.idx++;
            if (nav.idx >= nav.route.size()) nav.phase = nav.destIsDorm ? ASCEND : ARRIVED;
        }
    }

    private void stepAscend(NPC npc, Nav nav, float tpf) {
        npc.setX(DORM_X); npc.setZ(DORM_Z);
        nav.y += LIFT_SPEED * tpf;
        if (nav.y >= nav.roomY) { nav.y = nav.roomY; nav.phase = ROOM; }
    }

    private void stepRoom(NPC npc, Nav nav, float tpf) {
        if (moveXZ(npc, nav.roomX, nav.roomZ, tpf)) nav.phase = ARRIVED;
    }

    private void stepDescendWalk(NPC npc, Nav nav, float tpf) {
        // Walk (on the current floor) back to the lift shaft, then descend.
        if (moveXZ(npc, DORM_X, DORM_Z, tpf)) nav.phase = DESCEND;
    }

    private void stepDescend(NPC npc, Nav nav, float tpf) {
        npc.setX(DORM_X); npc.setZ(DORM_Z);
        nav.y -= LIFT_SPEED * tpf;
        if (nav.y <= 0) {
            nav.y = 0;
            nav.currentNode = "dorm";
            beginGroundRoute(npc, nav);
        }
    }

    /** Move the NPC toward (tx,tz); returns true when it arrives. Updates facing. */
    private boolean moveXZ(NPC npc, double tx, double tz, float tpf) {
        double dx = tx - npc.getX(), dz = tz - npc.getZ();
        double dist = Math.hypot(dx, dz);
        double step = npc.getSpeed() * tpf;
        if (dist <= step || dist < 0.05) { npc.setX(tx); npc.setZ(tz); return true; }
        npc.setX(npc.getX() + dx / dist * step);
        npc.setZ(npc.getZ() + dz / dist * step);
        npc.setFacing(Math.atan2(dx, dz));
        return false;
    }

    /** Map the NPC's schedule-driven state to a destination (node key, or DORMROOM). */
    private String destinationFor(NPC npc) {
        String state = npc.getState();
        if (state == null) return null;
        switch (state) {
            case "GOING_TO_CLASS":
            case "IN_CLASS":       return "classroom";
            case "GOING_TO_LUNCH": return "cafInterior";
            case "GOING_TO_LIBRARY": return "libInterior";
            case "GOING_TO_SPORTS":  return "gymInterior";
            case "SOCIALIZING":      return "mallInterior";
            case "GOING_TO_DORM":    return "DORMROOM";       // ride the lift to their room
            case "ARRIVING_AT_SCHOOL": return "courtyard";
            case "GOING_TO_ACTIVITY":
                if ("teacher".equals(npc.getRole())) return "councilA";
                String[] venues = {"courtyard", "mallInterior", "cafeA", "storeA", "gymInterior"};
                return venues[Math.abs(npc.getId().hashCode()) % venues.length];
            default: return null;
        }
    }
}
