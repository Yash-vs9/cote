package com.cote.simulation;

import java.util.ArrayList;
import java.util.List;

public class NPC {
    private final String id;
    private final String name;
    private final String persona;
    private final PersonalityTraits traits;
    private final String role;
    private final String assignedSeat;
    private final String spawnLoc;
    private final double speed;

    private String currentSpot;
    private String targetSpotId;
    private String state = "ARRIVING_AT_SCHOOL";
    private String currentActivity = "ARRIVING_AT_SCHOOL";
    private String activityReason = "Morning arrival routine";
    private double departureDelay = 0.0;
    private String routeId = "ROUTE_NONE";
    private List<String> activeRouteNodes = new ArrayList<>();
    private double x, z;
    private double facing = Math.PI;

    public NPC(String id, String name, String persona, PersonalityTraits traits, String role, String assignedSeat, String spawnLoc, double speed) {
        this.id = id;
        this.name = name;
        this.persona = persona;
        this.traits = traits;
        this.role = role;
        this.assignedSeat = assignedSeat;
        this.spawnLoc = spawnLoc;
        this.speed = speed;
        this.currentSpot = spawnLoc;
        double[] defaultPos = CampusGraph.NODES.getOrDefault(spawnLoc, new double[]{0.0, 0.0});
        this.x = defaultPos[0];
        this.z = defaultPos[1];
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public PersonalityTraits getTraits() { return traits; }
    public String getAssignedSeat() { return assignedSeat; }
    public String getSpawnLoc() { return spawnLoc; }
    public double getSpeed() { return speed; }
    public String getCurrentSpot() { return currentSpot; }
    public void setCurrentSpot(String s) { this.currentSpot = s; }
    public String getTargetSpotId() { return targetSpotId; }
    public void setTargetSpotId(String s) { this.targetSpotId = s; }
    public String getState() { return state; }
    public void setState(String s) { this.state = s; }
    public String getCurrentActivity() { return currentActivity; }
    public void setCurrentActivity(String s) { this.currentActivity = s; }
    public String getActivityReason() { return activityReason; }
    public void setActivityReason(String s) { this.activityReason = s; }
    public double getDepartureDelay() { return departureDelay; }
    public void setDepartureDelay(double d) { this.departureDelay = d; }
    public String getRouteId() { return routeId; }
    public void setRouteId(String r) { this.routeId = r; }
    public List<String> getActiveRouteNodes() { return activeRouteNodes; }
    public void setActiveRouteNodes(List<String> nodes) { this.activeRouteNodes = nodes; }
    public double getX() { return x; }
    public void setX(double x) { this.x = x; }
    public double getZ() { return z; }
    public void setZ(double z) { this.z = z; }
    public double getFacing() { return facing; }
    public void setFacing(double f) { this.facing = f; }

    public String toJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"id\":\"").append(id).append("\",");
        sb.append("\"name\":\"").append(name).append("\",");
        sb.append("\"role\":\"").append(role).append("\",");
        sb.append("\"archetype\":\"").append(traits.getArchetype()).append("\",");
        sb.append("\"traits\":").append(traits.toJson()).append(",");
        sb.append("\"state\":\"").append(state).append("\",");
        sb.append("\"currentActivity\":\"").append(currentActivity).append("\",");
        sb.append("\"activityReason\":\"").append(activityReason).append("\",");
        sb.append("\"currentSpot\":\"").append(currentSpot).append("\",");
        sb.append("\"targetSpotId\":").append(targetSpotId == null ? "null" : "\"" + targetSpotId + "\"").append(",");
        sb.append("\"routeId\":\"").append(routeId).append("\",");
        sb.append("\"departureDelay\":").append(String.format("%.2f", departureDelay)).append(",");
        sb.append("\"x\":").append(String.format("%.2f", x)).append(",");
        sb.append("\"z\":").append(String.format("%.2f", z));
        sb.append("}");
        return sb.toString();
    }
}
