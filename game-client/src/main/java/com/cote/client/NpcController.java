package com.cote.client;

import com.cote.simulation.CampusGraph;
import com.cote.simulation.NPC;
import com.cote.simulation.ReservationManager;
import com.cote.simulation.RouteManager;
import com.cote.simulation.SimulationEngine;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    private static final double DORM_DOOR_Z = 55;   // north corridor wall (room doors)
    private static final double[] DORM_ROOM_XS = { -42, -34, -26 };
    private static final double ACADEMIC_COUNCIL_Y = 12.75; // council room, 4th floor (3 x 4.25m)
    private static final double LIFT_SPEED = 4.0;   // m/s vertical

    // --- Smooth ground-travel tuning ---------------------------------------
    private static final float LOOKAHEAD = 1.6f;            // pure-pursuit aim distance along route (m)
    private static final float PASS_RADIUS = 0.9f;          // waypoint pass-through radius (m)
    private static final float PASS_RADIUS_SPEED_T = 0.30f; // radius grows with speed: speed * this
    private static final float MAX_YAW_SPEED = 3.5f;        // rad/s cap on facing changes (ground phase)
    private static final double STUCK_SURRENDER_SECS = 0.5; // wedged-waypoint give-up time (unchanged)
    private static final double TWO_PI = Math.PI * 2.0;

    // Phases of a journey.
    private static final int GROUND = 0, ASCEND = 1, ROOM = 2, DESCEND_WALK = 3, DESCEND = 4, ARRIVED = 5, SEAT = 6;

    private final SimulationEngine engine;
    private final RouteManager routes;
    private final ReservationManager reservations;

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
        double stuckTimer;    // time spent unable to advance (wall-blocked)
        double homeX, homeZ;  // this NPC's own dorm room (stable across destination changes)
        ReservationManager.Spot spot; // reserved seat to settle into after graph arrival
        // Vertical journey: the lift shaft and the waypoint path on the upper floor.
        double liftX, liftZ;
        String liftNode;
        List<double[]> roomPath;
        int pathIdx;
    }

    private final Map<String, Nav> navs = new HashMap<>();
    private final Map<String, double[]> dormRoom = new HashMap<>(); // id -> {roomX, roomZ, roomY}
    private final Map<String, String> arrivalReports = new HashMap<>(); // id -> place name just reached
    private final Set<String> paused = new HashSet<>(); // ids frozen via pauseNpc()

    public NpcController(SimulationEngine engine) {
        this.engine = engine;
        this.routes = engine.getRouteManager();
        this.reservations = engine.getReservationManager();
        // Assign each student a dorm room on floors 2..N (x cycles across 3 rooms).
        int floor = 2;
        for (NPC npc : engine.getNpcs()) {
            Nav nav = new Nav();
            nav.currentNode = npc.getSpawnLoc();
            navs.put(npc.getId(), nav);
            if (!"teacher".equals(npc.getRole())) {
                double rx = DORM_ROOM_XS[floor % DORM_ROOM_XS.length];
                double[] room = { rx, 50.0, floor * DORM_FH };
                dormRoom.put(npc.getId(), room);
                nav.homeX = room[0];
                nav.homeZ = room[1];
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

    /** Freeze an NPC exactly where it is: no stepping, no separation; route/state kept intact. */
    public void pauseNpc(String id) {
        if (id != null) paused.add(id);
    }

    /** Un-freeze a paused NPC; it resumes its journey from where it stopped. */
    public void resumeNpc(String id) {
        if (id != null) paused.remove(id);
    }

    /** True while the NPC is freeze-framed by pauseNpc() (unknown ids are never paused). */
    public boolean isPaused(String id) {
        return id != null && paused.contains(id);
    }

    /** True while the NPC is up in their dorm room (used for the knock-to-enter gate). */
    public boolean isHomeAsleep(String id) {
        Nav n = navs.get(id);
        return n != null && n.destIsDorm && n.phase == ARRIVED && n.y > 1.0;
    }

    /** True when the NPC finished its journey and is idling at its destination. */
    public boolean isArrived(String id) {
        Nav n = navs.get(id);
        return n != null && n.phase == ARRIVED;
    }

    /** Names of NPCs within {@code radius} metres on the same floor, excluding the speaker.
     *  Feeds the AI chat prompt so characters know who is standing around them. */
    public String nearbyNames(String excludeId, double radius) {
        NPC self = null;
        for (NPC n : engine.getNpcs()) if (n.getId().equals(excludeId)) { self = n; break; }
        if (self == null) return "";
        Nav selfNav = navs.get(excludeId);
        double selfY = selfNav != null ? selfNav.y : 0;
        StringBuilder sb = new StringBuilder();
        for (NPC other : engine.getNpcs()) {
            if (other.getId().equals(excludeId)) continue;
            Nav otherNav = navs.get(other.getId());
            double otherY = otherNav != null ? otherNav.y : 0;
            if (Math.abs(otherY - selfY) > 0.5) continue; // different floors never "nearby"
            double dx = other.getX() - self.getX(), dz = other.getZ() - self.getZ();
            if (dx * dx + dz * dz <= radius * radius) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(other.getName());
            }
        }
        return sb.toString();
    }

    /** A student whose assigned dorm room sits on the given floor, or null (for knock-to-answer). */
    public String npcOnDormFloor(int floor) {
        for (Map.Entry<String, double[]> e : dormRoom.entrySet()) {
            if ((int) Math.round(e.getValue()[2] / DORM_FH) == floor) return e.getKey();
        }
        return null;
    }

    /** Resident of one specific room index (0..2) on a floor; other rooms are empty. */
    public String npcOnDormFloor(int floor, int roomIdx) {
        if (roomIdx < 0 || roomIdx >= DORM_ROOM_XS.length) return null;
        // Rooms are assigned by floor, cycling through the three x positions.
        if (roomIdx != Math.floorMod(floor, DORM_ROOM_XS.length)) return null;
        return npcOnDormFloor(floor);
    }

    public void update(float tpf) {
        for (NPC npc : engine.getNpcs()) {
            Nav nav = navs.get(npc.getId());
            if (nav == null || paused.contains(npc.getId())) continue; // frozen: hold pose

            // A player command overrides the schedule; otherwise follow the daily routine.
            String desired = (nav.override != null) ? nav.override : destinationFor(npc);
            if (desired == null) continue;

            if (!desired.equals(nav.destKey) && nav.phase != ASCEND && nav.phase != DESCEND) {
                nav.destKey = desired;
                resolveTarget(npc, nav, desired);
                // Commands respond immediately; scheduled moves keep their staggered delay.
                nav.delayRemaining = (nav.override != null) ? 0.0 : Math.max(0.0, npc.getDepartureDelay());
                if (nav.y > 0.5) {
                    nav.phase = DESCEND_WALK;
                    nav.pathIdx = nav.roomPath != null ? nav.roomPath.size() - 1 : -1;
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
                case SEAT:         stepSeat(npc, nav, tpf); break;
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

        separate(tpf);
    }

    /** Pairwise repulsion: keep NPCs closer than 1.1m apart so they never stack on shared nodes. */
    private void separate(float tpf) {
        List<NPC> npcs = engine.getNpcs();
        for (int i = 0; i < npcs.size(); i++) {
            NPC a = npcs.get(i);
            Nav na = navs.get(a.getId());
            if (na == null || na.phase == ASCEND || na.phase == DESCEND
                    || paused.contains(a.getId())) continue;
            for (int j = i + 1; j < npcs.size(); j++) {
                NPC b = npcs.get(j);
                Nav nb = navs.get(b.getId());
                if (nb == null || nb.phase == ASCEND || nb.phase == DESCEND
                    || paused.contains(b.getId())) continue;
                if (Math.abs(na.y - nb.y) > 0.5) continue; // different floors never repel
                double dx = b.getX() - a.getX(), dz = b.getZ() - a.getZ();
                double d2 = dx * dx + dz * dz;
                if (d2 >= 1.1 * 1.1 || d2 < 1e-6) continue;
                double d = Math.sqrt(d2);
                double push = Math.min(0.8 * tpf, (1.1 - d) * 0.5);
                double ux = dx / d, uz = dz / d;
                a.setX(a.getX() - ux * push); a.setZ(a.getZ() - uz * push);
                b.setX(b.getX() + ux * push); b.setZ(b.getZ() + uz * push);
            }
        }
    }

    private void resolveTarget(NPC npc, Nav nav, String desired) {
        if ("DORMROOM".equals(desired) && dormRoom.containsKey(npc.getId())) {
            double[] r = dormRoom.get(npc.getId());
            nav.destIsDorm = true;
            nav.approachNode = "dorm";
            nav.roomX = r[0]; nav.roomZ = r[1]; nav.roomY = r[2];
            nav.liftX = DORM_X; nav.liftZ = DORM_Z; nav.liftNode = "dorm";
            nav.roomPath = new ArrayList<>();
            nav.roomPath.add(new double[]{ r[0], DORM_DOOR_Z });
            nav.roomPath.add(new double[]{ r[0], r[1] });
            nav.pathIdx = 0;
            nav.spot = null;
        } else if ("councilA".equals(desired)) {
            // The council room is on the top floor: ride the academic lift, then walk
            // around the room's south side to its west door instead of clipping walls.
            nav.destIsDorm = false;
            nav.approachNode = "councilA";
            nav.roomX = 24; nav.roomZ = -56; nav.roomY = ACADEMIC_COUNCIL_Y;
            nav.liftX = 24; nav.liftZ = -49; nav.liftNode = "councilA";
            nav.roomPath = new ArrayList<>();
            nav.roomPath.add(new double[]{ 19, -49 });
            nav.roomPath.add(new double[]{ 19, -56 });
            nav.roomPath.add(new double[]{ 21, -56 });
            nav.roomPath.add(new double[]{ 24, -56 });
            nav.pathIdx = 0;
            nav.spot = null;
        } else {
            nav.destIsDorm = false;
            nav.approachNode = "DORMROOM".equals(desired) ? "dorm" : desired;
            double[] c = CampusGraph.NODES.get(nav.approachNode);
            nav.roomX = c != null ? c[0] : npc.getX();
            nav.roomZ = c != null ? c[1] : npc.getZ();
            nav.roomY = 0;
            if (nav.y <= 0.5) { nav.roomPath = null; nav.liftNode = null; }
            // Seat-level arrival: settle onto the exact reserved spot (desk/cafeteria/library seat).
            // Guarded by building match so a stale targetSpotId never drags the NPC across campus.
            String spotLoc = spotLocFor(nav.approachNode);
            ReservationManager.Spot s = (spotLoc == null || npc.getTargetSpotId() == null)
                    ? null : reservations.getSpot(npc.getTargetSpotId());
            nav.spot = (s != null && s.loc.equals(spotLoc)) ? s : null;
        }
    }

    /** Which ReservationManager location string an interior destination node maps to, or null. */
    private String spotLocFor(String approachNode) {
        switch (approachNode) {
            case "classroom":   return "class1d";
            case "cafInterior": return "cafeteria";
            case "libInterior": return "library";
            default: return null;
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
            arriveAfterRoute(nav);
            return;
        }
        double[] node = CampusGraph.NODES.get(nav.route.get(nav.idx));
        if (node == null) { nav.idx++; return; }

        double r = PASS_RADIUS + npc.getSpeed() * PASS_RADIUS_SPEED_T;
        double dxw = node[0] - npc.getX(), dzw = node[1] - npc.getZ();
        if (dxw * dxw + dzw * dzw < r * r) {
            nav.stuckTimer = 0;
            advanceToNextNode(npc, nav);
            return;
        }

        // Outdoor / building-entry travel respects walls; the pursuit point is wall-tested so
        // doorway threading still funnels NPCs through gaps when corner-cutting would clip a wall.
        double[] aim = pursuitPoint(npc, nav);
        if (collidesAt(aim[0], aim[1], nav.y)) { aim[0] = node[0]; aim[1] = node[1]; }

        if (moveXZColliding(npc, nav, aim[0], aim[1], tpf, false)) {
            nav.stuckTimer = 0;
            advanceToNextNode(npc, nav);
        }
    }

    /** Mark route[idx] visited and step to the next waypoint (arriving if that was the last). */
    private void advanceToNextNode(NPC npc, Nav nav) {
        nav.currentNode = nav.route.get(nav.idx);
        npc.setCurrentSpot(nav.currentNode);
        nav.idx++;
        if (nav.idx >= nav.route.size()) arriveAfterRoute(nav);
    }

    /**
     * Pure-pursuit aim point: project onto the current segment (route[idx-1] -> route[idx]),
     * then walk LOOKAHEAD metres forward along the polyline. When the lookahead reaches past
     * the current node it lands on the NEXT segment, so steering naturally cuts the corner.
     */
    private double[] pursuitPoint(NPC npc, Nav nav) {
        double[] node = CampusGraph.NODES.get(nav.route.get(nav.idx));
        double ax, az;
        if (nav.idx > 0) {
            double[] prev = CampusGraph.NODES.get(nav.route.get(nav.idx - 1));
            if (prev != null) { ax = prev[0]; az = prev[1]; } else { ax = node[0]; az = node[1]; }
        } else { ax = npc.getX(); az = npc.getZ(); }

        double abx = node[0] - ax, abz = node[1] - az;
        double abLen2 = abx * abx + abz * abz;
        if (abLen2 < 1e-9) return new double[]{ node[0], node[1] };

        double t = ((npc.getX() - ax) * abx + (npc.getZ() - az) * abz) / abLen2;
        t = Math.max(0.0, Math.min(1.0, t));
        double cx = ax + abx * t, cz = az + abz * t;

        double remain = LOOKAHEAD;
        int i = nav.idx;
        while (i < nav.route.size()) {
            double[] n2 = CampusGraph.NODES.get(nav.route.get(i));
            if (n2 == null) break;
            double sx = n2[0] - cx, sz = n2[1] - cz;
            double sl = Math.sqrt(sx * sx + sz * sz);
            if (sl >= remain && sl > 1e-9) {
                return new double[]{ cx + sx / sl * remain, cz + sz / sl * remain };
            }
            remain -= Math.max(sl, 0.0);
            cx = n2[0]; cz = n2[1];
            i++;
        }
        return new double[]{ cx, cz };
    }

    /** Graph route done: head for the reserved seat's exact micro-position, else arrive. */
    private void arriveAfterRoute(Nav nav) {
        if (nav.roomPath != null) { nav.phase = ASCEND; return; } // dorm room or council room
        if (!nav.destIsDorm && nav.spot != null) {
            nav.phase = SEAT;
            return;
        }
        nav.phase = nav.destIsDorm ? ASCEND : ARRIVED;
    }

    private void stepSeat(NPC npc, Nav nav, float tpf) {
        ReservationManager.Spot s = nav.spot;
        if (s == null) { nav.phase = ARRIVED; return; }
        if (moveXZColliding(npc, nav, s.x, s.z, tpf, true)) {
            npc.setFacing(s.facing); // sit aligned with the spot's reserved facing
            nav.phase = ARRIVED;
        }
    }

    private void stepAscend(NPC npc, Nav nav, float tpf) {
        double lx = nav.liftNode != null ? nav.liftX : DORM_X;
        double lz = nav.liftNode != null ? nav.liftZ : DORM_Z;
        npc.setX(lx); npc.setZ(lz);
        nav.y += LIFT_SPEED * tpf;
        if (nav.y >= nav.roomY) { nav.y = nav.roomY; nav.pathIdx = 0; nav.phase = ROOM; }
    }

    private void stepRoom(NPC npc, Nav nav, float tpf) {
        // Thread the real door gap in the corridor wall instead of cutting through it.
        if (nav.roomPath != null) {
            while (nav.pathIdx < nav.roomPath.size()) {
                double[] wp = nav.roomPath.get(nav.pathIdx);
                if (!moveXZColliding(npc, nav, wp[0], wp[1], tpf, true)) return;
                nav.pathIdx++;
            }
            nav.phase = nav.spot != null ? SEAT : ARRIVED;
            return;
        }
        if (Math.abs(npc.getZ() - DORM_DOOR_Z) > 0.6) {
            moveXZColliding(npc, nav, nav.roomX, DORM_DOOR_Z, tpf, false);
            return;
        }
        if (moveXZColliding(npc, nav, nav.roomX, nav.roomZ, tpf, true)) {
            nav.phase = nav.spot != null ? SEAT : ARRIVED;
        }
    }

    private void stepDescendWalk(NPC npc, Nav nav, float tpf) {
        // Walk back out through the room's door, then along the corridor to the lift shaft.
        if (nav.roomPath != null) {
            if (nav.pathIdx >= 0) {
                double[] wp = nav.roomPath.get(nav.pathIdx);
                if (moveXZColliding(npc, nav, wp[0], wp[1], tpf, false)) nav.pathIdx--;
                return;
            }
            if (moveXZColliding(npc, nav, nav.liftX, nav.liftZ, tpf, false)) nav.phase = DESCEND;
            return;
        }
        if (Math.abs(npc.getZ() - DORM_DOOR_Z) > 0.6) {
            moveXZColliding(npc, nav, nav.homeX, DORM_DOOR_Z, tpf, false);
            return;
        }
        if (moveXZColliding(npc, nav, DORM_X, DORM_Z, tpf, false)) nav.phase = DESCEND;
    }

    private void stepDescend(NPC npc, Nav nav, float tpf) {
        double lx = nav.liftNode != null ? nav.liftX : DORM_X;
        double lz = nav.liftNode != null ? nav.liftZ : DORM_Z;
        npc.setX(lx); npc.setZ(lz);
        nav.y -= LIFT_SPEED * tpf;
        if (nav.y <= 0) {
            nav.y = 0;
            nav.currentNode = nav.liftNode != null ? nav.liftNode : "dorm";
            nav.roomPath = null; nav.pathIdx = -1; nav.liftNode = null;
            beginGroundRoute(npc, nav);
        }
    }

    /** Move the NPC toward (tx,tz); returns true when it arrives. Updates facing. (No wall test — indoor/vertical use.) */
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

    /** Wall-aware move toward (tx,tz): slides along blocked axes so NPCs can't pass through walls,
     *  only through door gaps. If fully wedged for a moment, gives up on this waypoint so it never freezes.
     *  snapOnArrive: teleport onto (tx,tz) when arrived (SEAT/indoor precision); false lets GROUND
     *  pass through waypoints without snapping. Facing is rate-limited during GROUND, instant otherwise. */
    private boolean moveXZColliding(NPC npc, Nav nav, double tx, double tz, float tpf, boolean snapOnArrive) {
        double x = npc.getX(), z = npc.getZ();
        double dx = tx - x, dz = tz - z;
        double dist = Math.hypot(dx, dz);
        double step = npc.getSpeed() * tpf;
        if (dist <= step || dist < 0.05) {
            if (snapOnArrive) { npc.setX(tx); npc.setZ(tz); }
            nav.stuckTimer = 0;
            return true;
        }

        double ux = dx / dist, uz = dz / dist;

        // If the NPC is ALREADY overlapping walls (spawned inside a building, threading an
        // interior, or grazing a corner), don't fight it — move freely so it can never get
        // trapped. Wall-blocking only applies when walking from open space INTO a wall.
        if (collidesAt(x, z, nav.y)) {
            npc.setX(x + ux * step); npc.setZ(z + uz * step);
            applyFacing(npc, nav, dx, dz, tpf);
            nav.stuckTimer = 0;
            return false;
        }

        double nx = x + ux * step, nz = z + uz * step;
        boolean blockedX = collidesAt(nx, z, nav.y);
        boolean blockedZ = collidesAt(x, nz, nav.y);

        boolean moved = false;
        if (!blockedX && !blockedZ)      { npc.setX(nx); npc.setZ(nz); moved = true; }
        else if (!blockedX)              { npc.setX(nx); moved = true; } // slide along X
        else if (!blockedZ)              { npc.setZ(nz); moved = true; } // slide along Z

        if (moved) {
            applyFacing(npc, nav, dx, dz, tpf);
            nav.stuckTimer = 0;
            return false;
        }
        // Wedged (both axes blocked): give up this waypoint quickly so it never freezes.
        nav.stuckTimer += tpf;
        if (nav.stuckTimer > STUCK_SURRENDER_SECS) { nav.stuckTimer = 0; return true; }
        return false;
    }

    /** Ease facing toward the aim heading during GROUND travel (capped at MAX_YAW_SPEED rad/s,
     *  delta wrapped to [-pi, pi]); instant elsewhere so SEAT/indoor behavior is unchanged. */
    private void applyFacing(NPC npc, Nav nav, double dx, double dz, float tpf) {
        double yaw = Math.atan2(dx, dz);
        if (nav.phase != GROUND) { npc.setFacing(yaw); return; }
        float cur = (float) npc.getFacing();
        double delta = (yaw - cur) % TWO_PI;
        if (delta > Math.PI) delta -= TWO_PI;
        else if (delta < -Math.PI) delta += TWO_PI;
        double maxTurn = MAX_YAW_SPEED * tpf;
        if (delta > maxTurn) delta = maxTurn;
        else if (delta < -maxTurn) delta = -maxTurn;
        npc.setFacing(cur + delta);
    }

    /** True if a person-sized box at (x, y, z) overlaps any campus wall collider. */
    private boolean collidesAt(double x, double z, double y) {
        float px = (float) x, pz = (float) z, py = (float) y + 0.2f;
        for (CampusBuilder.AABB a : CampusBuilder.colliders) {
            if (a.intersects(px, py, pz, 0.35f, 1.4f)) return true;
        }
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
