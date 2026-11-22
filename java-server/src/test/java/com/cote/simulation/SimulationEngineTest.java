package com.cote.simulation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Regression coverage for clock jumps (story TIME steps and save restoration). */
public class SimulationEngineTest {

    @Test
    public void nightToMorningJumpAdvancesTheDay() {
        SimulationEngine engine = new SimulationEngine();
        engine.setDay(1);
        engine.setClockMin(18 * 60);
        engine.setClockMin(7 * 60 + 50);
        assertEquals(2, engine.getDay());
    }

    @Test
    public void smallRewindStaysOnTheSameDay() {
        SimulationEngine engine = new SimulationEngine();
        engine.setDay(1);
        engine.setClockMin(7 * 60 + 45);
        engine.setClockMin(7 * 60 + 40);
        assertEquals(1, engine.getDay());
    }

    @Test
    public void restoringASaveNeverAdvancesTheDay() {
        SimulationEngine engine = new SimulationEngine();
        engine.setDay(3);
        engine.restoreClock(60);
        assertEquals(3, engine.getDay());
        assertEquals(60, engine.getClockMin(), 0.001);
    }
}
