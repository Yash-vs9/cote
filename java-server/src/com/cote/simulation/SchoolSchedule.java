package com.cote.simulation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SchoolSchedule {
    private final List<ScheduleEvent> events = new ArrayList<>();

    public SchoolSchedule() {
        // 07:30 - 08:15 Morning Arrival & Free Socializing
        events.add(new ScheduleEvent("ARRIVE", 7 * 60 + 30, 8 * 60 + 15, "Morning Arrival & Gate Leisure", "ARRIVING_AT_SCHOOL", "courtyard"));
        // 08:15 - 10:00 Morning Homeroom & Class Period 1
        events.add(new ScheduleEvent("CLASS_1", 8 * 60 + 15, 10 * 60, "Class 1-D Academic Lecture 1", "CLASS", "class1d"));
        // 10:00 - 10:15 Classroom Break
        events.add(new ScheduleEvent("BREAK_1", 10 * 60, 10 * 60 + 15, "15-Minute Morning Recess", "BREAK", "class1d"));
        // 10:15 - 12:00 Class Period 2
        events.add(new ScheduleEvent("CLASS_2", 10 * 60 + 15, 12 * 60, "Class 1-D Academic Lecture 2", "CLASS", "class1d"));
        // 12:00 - 13:00 Lunch at Cafeteria
        events.add(new ScheduleEvent("LUNCH", 12 * 60, 13 * 60, "School Cafeteria Dining", "LUNCH", "cafeteria"));
        // 13:00 - 15:00 Afternoon Class
        events.add(new ScheduleEvent("CLASS_3", 13 * 60, 15 * 60, "Afternoon S-System Seminar", "AFTERNOON_CLASS", "class1d"));
        // 15:00 - 17:30 Personality-Driven After-School Activities
        events.add(new ScheduleEvent("AFTER_SCHOOL", 15 * 60, 17 * 60 + 30, "Club Activities & Study Sessions", "PERSONAL_ACTIVITY", "library"));
        // 17:30 - 20:00 Evening Free Leisure
        events.add(new ScheduleEvent("EVENING", 17 * 60 + 30, 20 * 60, "Keyaki Mall & Seaside Leisure", "EVENING_LEISURE", "mall"));
        // 20:00 - 22:30 Dormitory Study & Relaxation
        events.add(new ScheduleEvent("DORM", 20 * 60, 22 * 60 + 30, "Dormitory Private Study", "DORM_TIME", "dorm"));
        // 22:30 - 07:30 Curfew & Night Rest
        events.add(new ScheduleEvent("NIGHT", 22 * 60 + 30, 24 * 60 + 7 * 60 + 30, "Campus Curfew & Night Rest", "NIGHT_REST", "dorm"));
    }

    public List<ScheduleEvent> getEvents() {
        return Collections.unmodifiableList(events);
    }

    public ScheduleEvent getCurrentEvent(int minuteOfDay) {
        int m = minuteOfDay % (24 * 60);
        for (ScheduleEvent e : events) {
            if (e.getStartMin() <= e.getEndMin()) {
                if (m >= e.getStartMin() && m < e.getEndMin()) return e;
            } else {
                // Crosses midnight
                if (m >= e.getStartMin() || m < (e.getEndMin() % (24 * 60))) return e;
            }
        }
        return events.get(0);
    }
}
