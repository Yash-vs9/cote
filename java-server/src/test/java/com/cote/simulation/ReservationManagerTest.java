package com.cote.simulation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

public class ReservationManagerTest {
    private ReservationManager reservationManager;

    @BeforeEach
    public void setup() {
        reservationManager = new ReservationManager();
    }

    @Test
    public void testSpotAllocation() {
        Set<String> allocatedClassDesks = new HashSet<>();
        // Simulate 25 students requesting classroom desks (since there are 5x5=25 desks)
        for (int i = 0; i < 25; i++) {
            String npcId = "student" + i;
            ReservationManager.Spot spot = reservationManager.findAvailableSpot("class1d", "desk_seat");
            assertNotNull(spot, "Should find an available spot for student " + i);
            
            boolean reserved = reservationManager.reserve(spot.id, npcId);
            assertTrue(reserved, "Should successfully reserve the spot");
            
            assertFalse(allocatedClassDesks.contains(spot.id), "No two students should receive duplicate spotId allocations");
            allocatedClassDesks.add(spot.id);
        }
        
        // 26th student should not find a desk
        ReservationManager.Spot spot26 = reservationManager.findAvailableSpot("class1d", "desk_seat");
        assertNull(spot26, "No desks should be available after 25 reservations");
        
        Set<String> allocatedCafeteriaChairs = new HashSet<>();
        // Simulate 24 students requesting cafeteria dining chairs (6 tables * 4 seats = 24 seats)
        for (int i = 0; i < 24; i++) {
            String npcId = "student" + i;
            ReservationManager.Spot spot = reservationManager.findAvailableSpot("cafeteria", "dining_seat");
            assertNotNull(spot, "Should find an available spot for student " + i);
            
            boolean reserved = reservationManager.reserve(spot.id, npcId);
            assertTrue(reserved, "Should successfully reserve the spot");
            
            assertFalse(allocatedCafeteriaChairs.contains(spot.id), "No two students should receive duplicate spotId allocations");
            allocatedCafeteriaChairs.add(spot.id);
        }
        
        // 25th student should not find a cafeteria chair
        ReservationManager.Spot spot25 = reservationManager.findAvailableSpot("cafeteria", "dining_seat");
        assertNull(spot25, "No cafeteria chairs should be available after 24 reservations");
    }
}
