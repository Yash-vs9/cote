package com.cote.simulation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class SchoolScheduleTest {
    private SchoolSchedule schoolSchedule;

    @BeforeEach
    public void setup() {
        schoolSchedule = new SchoolSchedule();
    }

    @Test
    public void testAll24HoursMapped() {
        // Assert that all 24 hours (0..1439 min) map to valid schedule events
        for (int m = 0; m < 1440; m++) {
            ScheduleEvent event = schoolSchedule.getCurrentEvent(m);
            assertNotNull(event, "Event should not be null for minute " + m);
            assertNotNull(event.getId(), "Event ID should not be null for minute " + m);
        }
    }
    
    @Test
    public void testMidnightWraparound() {
        // 22:30 is 1350 minutes
        // 07:29 is 449 minutes
        
        ScheduleEvent nightEventStart = schoolSchedule.getCurrentEvent(1350);
        assertEquals("NIGHT", nightEventStart.getId());
        
        ScheduleEvent nightEventMid = schoolSchedule.getCurrentEvent(5); // 00:05
        assertEquals("NIGHT", nightEventMid.getId());
        
        ScheduleEvent nightEventEnd = schoolSchedule.getCurrentEvent(449);
        assertEquals("NIGHT", nightEventEnd.getId());
        
        // At 07:30 (450 mins), it should be ARRIVE
        ScheduleEvent arriveEvent = schoolSchedule.getCurrentEvent(450);
        assertEquals("ARRIVE", arriveEvent.getId());
    }
}
