package com.cote.simulation;

public class ScheduleEvent {
    private final String id;
    private final int startMin;
    private final int endMin;
    private final String label;
    private final String activity;
    private final String loc;

    public ScheduleEvent(String id, int startMin, int endMin, String label, String activity, String loc) {
        this.id = id;
        this.startMin = startMin;
        this.endMin = endMin;
        this.label = label;
        this.activity = activity;
        this.loc = loc;
    }

    public String getId() { return id; }
    public int getStartMin() { return startMin; }
    public int getEndMin() { return endMin; }
    public String getLabel() { return label; }
    public String getActivity() { return activity; }
    public String getLoc() { return loc; }

    public String toJson() {
        return String.format("{\"id\":\"%s\",\"startMin\":%d,\"endMin\":%d,\"label\":\"%s\",\"activity\":\"%s\",\"loc\":\"%s\"}",
                id, startMin, endMin, label, activity, loc);
    }
}
