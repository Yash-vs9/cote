package com.cote.simulation;

import java.util.*;

public class SimulationEngine {
    private final SchoolSchedule schedule = new SchoolSchedule();
    private final TrafficManager trafficManager = new TrafficManager();
    private final RouteManager routeManager;
    private final DoorwayQueueManager doorwayQueueManager = new DoorwayQueueManager();
    private final ReservationManager reservationManager = new ReservationManager();
    private final List<NPC> npcs = new ArrayList<>();

    private double clockMin = 7.75 * 60; // 07:45 Morning Arrival
    private int day = 1;
    private ScheduleEvent currentEvent = null;

    public SimulationEngine() {
        this.routeManager = new RouteManager(trafficManager);
        initNPCs();
    }

    private void initNPCs() {
        npcs.add(new NPC("horikita", "Horikita", "Horikita Suzune — reserved, direct, serious",
                new PersonalityTraits(0.98, 0.95, 0.60, 0.15, 0.85), "student", "CLASS_1D_SEAT_13", "dorm", 2.4));

        npcs.add(new NPC("kushida", "Kushida", "Kushida Kikyou — relentlessly cheerful, popular",
                new PersonalityTraits(0.65, 0.60, 0.55, 0.99, 0.80), "student", "CLASS_1D_SEAT_08", "courtyard", 2.5));

        npcs.add(new NPC("sudou", "Sudou", "Sudou Ken — red-haired basketball recruit, athletic",
                new PersonalityTraits(0.35, 0.30, 0.98, 0.60, 0.40), "student", "CLASS_1D_SEAT_03", "fieldW", 2.9));

        npcs.add(new NPC("kouenji", "Kouenji", "Kouenji Rokusuke — wealthy heir, narcissistic",
                new PersonalityTraits(0.88, 0.15, 0.92, 0.10, 0.50), "student", "CLASS_1D_SEAT_25", "cafeA", 2.0));

        npcs.add(new NPC("chabashira", "Chabashira", "Chabashira Sae — Class 1-D homeroom teacher",
                new PersonalityTraits(0.95, 0.99, 0.70, 0.40, 0.70), "teacher", "CLASS_1D_TEACHER", "hallA", 2.3));

        npcs.add(new NPC("hirata", "Hirata", "Hirata Yousuke — friendly, reliable leader",
                new PersonalityTraits(0.82, 0.90, 0.85, 0.92, 0.75), "student", "CLASS_1D_SEAT_11", "courtyard", 2.5));

        npcs.add(new NPC("karuizawa", "Karuizawa", "Karuizawa Kei — fashionable, decisive",
                new PersonalityTraits(0.55, 0.50, 0.40, 0.95, 0.70), "student", "CLASS_1D_SEAT_17", "storeA", 2.2));

        npcs.add(new NPC("yukimura", "Yukimura", "Yukimura Teruhiko — studious, analytical",
                new PersonalityTraits(0.94, 0.92, 0.30, 0.40, 0.88), "student", "CLASS_1D_SEAT_06", "libA", 2.3));

        npcs.add(new NPC("sakura", "Sakura", "Sakura Airi — shy, quiet",
                new PersonalityTraits(0.70, 0.80, 0.30, 0.20, 0.82), "student", "CLASS_1D_SEAT_22", "dorm", 2.0));

        npcs.add(new NPC("ike", "Ike", "Ike Kanji — energetic, casual",
                new PersonalityTraits(0.40, 0.35, 0.65, 0.80, 0.60), "student", "CLASS_1D_SEAT_02", "cafA", 2.3));

        npcs.add(new NPC("yamauchi", "Yamauchi", "Yamauchi Haruki — boastful, comedic",
                new PersonalityTraits(0.38, 0.30, 0.60, 0.78, 0.55), "student", "CLASS_1D_SEAT_04", "gateN", 2.2));
    }

    public synchronized void tick(double deltaSeconds) {
        double prevMin = clockMin;
        // 20 real minutes = 24 in-game hours
        clockMin = (clockMin + deltaSeconds * (1440.0 / (20.0 * 60.0))) % (24 * 60);
        if (clockMin < prevMin) day++;

        ScheduleEvent evt = schedule.getCurrentEvent((int) clockMin);
        if (currentEvent == null || !currentEvent.getId().equals(evt.getId())) {
            currentEvent = evt;
            evaluateScheduleTransition(evt);
        }
    }

    private void evaluateScheduleTransition(ScheduleEvent evt) {
        for (int i = 0; i < npcs.size(); i++) {
            NPC npc = npcs.get(i);
            evaluateNPCPurpose(npc, evt);

            // Staggered departure delays (0.5s to 38.0s)
            if ("teacher".equals(npc.getRole())) {
                npc.setDepartureDelay(0.5);
            } else {
                double disc = npc.getTraits().getDiscipline();
                double delay;
                switch (npc.getId()) {
                    case "horikita": delay = 1.8; break;
                    case "yukimura": delay = 3.2; break;
                    case "hirata": delay = 5.0; break;
                    case "kushida": delay = 10.5; break;
                    case "sakura": delay = 14.0; break;
                    case "karuizawa": delay = 18.5; break;
                    case "sudou": delay = 24.0; break;
                    case "ike": delay = 28.0; break;
                    case "yamauchi": delay = 32.5; break;
                    case "kouenji": delay = 38.0; break;
                    default:
                        delay = ((i % 8) * 4.0) + (1.0 - disc) * 12.0;
                }
                npc.setDepartureDelay(delay);
            }
        }
    }

    private void evaluateNPCPurpose(NPC npc, ScheduleEvent evt) {
        // Teacher
        if ("teacher".equals(npc.getRole())) {
            if ("CLASS".equals(evt.getActivity()) || "AFTERNOON_CLASS".equals(evt.getActivity())) {
                npc.setTargetSpotId("CLASS_1D_TEACHER");
                npc.setCurrentActivity("TEACHING_CLASS");
                npc.setActivityReason("Delivering homeroom lecture in Class 1-D");
                npc.setState("GOING_TO_CLASS");
            } else {
                npc.setCurrentActivity("OFFICE_HOURS");
                npc.setActivityReason("Reviewing class performance in Faculty Council Room");
                npc.setState("GOING_TO_ACTIVITY");
            }
            return;
        }

        // Students
        switch (evt.getActivity()) {
            case "ARRIVING_AT_SCHOOL":
                npc.setCurrentActivity("MORNING_LEISURE");
                npc.setActivityReason("Spending morning free time at campus plaza");
                npc.setState("ARRIVING_AT_SCHOOL");
                break;
            case "CLASS":
            case "AFTERNOON_CLASS":
                reservationManager.reserve(npc.getAssignedSeat(), npc.getId());
                npc.setTargetSpotId(npc.getAssignedSeat());
                npc.setCurrentActivity("ATTENDING_CLASS");
                npc.setActivityReason("Attending scheduled academic lecture in Class 1-D");
                npc.setState("GOING_TO_CLASS");
                break;
            case "BREAK":
                npc.setCurrentActivity("CLASSROOM_BREAK");
                npc.setActivityReason("Relaxing during 15-minute recess");
                npc.setState("IN_CLASS");
                break;
            case "LUNCH":
                reservationManager.releaseAllForNPC(npc.getId());
                ReservationManager.Spot spot = reservationManager.findAvailableSpot("cafeteria", "dining_seat");
                if (spot != null) {
                    reservationManager.reserve(spot.id, npc.getId());
                    npc.setTargetSpotId(spot.id);
                }
                npc.setCurrentActivity("LUNCH_DINING");
                npc.setActivityReason("Eating lunch and socializing at the school cafeteria");
                npc.setState("GOING_TO_LUNCH");
                break;
            case "PERSONAL_ACTIVITY":
                reservationManager.releaseAllForNPC(npc.getId());
                if (npc.getTraits().getIntelligence() > 0.85) {
                    ReservationManager.Spot libSpot = reservationManager.findAvailableSpot("library", "library_seat");
                    if (libSpot != null) reservationManager.reserve(libSpot.id, npc.getId());
                    npc.setTargetSpotId(libSpot != null ? libSpot.id : null);
                    npc.setCurrentActivity("AFTER_SCHOOL_LIBRARY");
                    npc.setActivityReason("Studying and researching at Memorial Library");
                    npc.setState("GOING_TO_LIBRARY");
                } else if (npc.getTraits().getAthleticism() > 0.85) {
                    npc.setCurrentActivity("AFTER_SCHOOL_SPORTS");
                    npc.setActivityReason("Basketball drill practice at gymnasium");
                    npc.setState("GOING_TO_SPORTS");
                } else {
                    npc.setCurrentActivity("AFTER_SCHOOL_SOCIAL");
                    npc.setActivityReason("Hanging out at Keyaki Mall / Palette Cafe");
                    npc.setState("SOCIALIZING");
                }
                break;
            case "EVENING_LEISURE":
                reservationManager.releaseAllForNPC(npc.getId());
                npc.setCurrentActivity("EVENING_FREE_TIME");
                npc.setActivityReason("Evening free time across campus");
                npc.setState("GOING_TO_ACTIVITY");
                break;
            case "DORM_TIME":
            case "NIGHT_REST":
                reservationManager.releaseAllForNPC(npc.getId());
                npc.setCurrentActivity("DORMITORY_REST");
                npc.setActivityReason("Residential dormitory rest");
                npc.setState("GOING_TO_DORM");
                break;
        }
    }

    /** Restore a saved clock without treating the jump as a day rollover. */
    public synchronized void restoreClock(double minutes) {
        this.clockMin = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
        this.currentEvent = null;
        tick(0.0);
    }

    public synchronized void setClockMin(double minutes) {
        double old = clockMin;
        double next = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
        // A large backward jump is a trip past midnight (story TIME jumps such as
        // 18:00 -> 07:50 next morning); small rewinds/forward jumps stay on the same day.
        if (next < old && old - next >= 6 * 60) day++;
        this.clockMin = next;
        this.currentEvent = null;
        tick(0.0);
    }

    /** Restore the persisted day counter (save/load). */
    public synchronized void setDay(int day) {
        this.day = Math.max(1, day);
    }

    public RouteManager getRouteManager() { return routeManager; }
    public TrafficManager getTrafficManager() { return trafficManager; }
    public ReservationManager getReservationManager() { return reservationManager; }
    public List<NPC> getNpcs() { return Collections.unmodifiableList(npcs); }
    public double getClockMin() { return clockMin; }
    public int getDay() { return day; }
    public ScheduleEvent getCurrentEvent() { return currentEvent; }

    public String getFormattedTime() {
        int h = ((int) clockMin / 60) % 24;
        int m = (int) clockMin % 60;
        return String.format("%02d:%02d", h, m);
    }
}
