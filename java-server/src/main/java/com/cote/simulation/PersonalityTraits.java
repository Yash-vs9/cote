package com.cote.simulation;

public class PersonalityTraits {
    private final double intelligence;
    private final double discipline;
    private final double athleticism;
    private final double social;
    private final double curiosity;

    public PersonalityTraits(double intelligence, double discipline, double athleticism, double social, double curiosity) {
        this.intelligence = Math.max(0.0, Math.min(1.0, intelligence));
        this.discipline = Math.max(0.0, Math.min(1.0, discipline));
        this.athleticism = Math.max(0.0, Math.min(1.0, athleticism));
        this.social = Math.max(0.0, Math.min(1.0, social));
        this.curiosity = Math.max(0.0, Math.min(1.0, curiosity));
    }

    public double getIntelligence() { return intelligence; }
    public double getDiscipline() { return discipline; }
    public double getAthleticism() { return athleticism; }
    public double getSocial() { return social; }
    public double getCuriosity() { return curiosity; }

    public String getArchetype() {
        if (intelligence >= 0.85 || (intelligence >= 0.8 && discipline >= 0.8)) return "Academic / Nerdy";
        if (athleticism >= 0.85) return "Sports Athlete";
        if (social >= 0.85) return "Social Butterfly";
        if (discipline <= 0.35 && social >= 0.6) return "Slacker / Casual";
        if (intelligence >= 0.75 && social >= 0.75) return "Class Leader";
        return "Balanced Student";
    }

    public String toJson() {
        return String.format("{\"intelligence\":%.2f,\"discipline\":%.2f,\"athleticism\":%.2f,\"social\":%.2f,\"curiosity\":%.2f,\"archetype\":\"%s\"}",
                intelligence, discipline, athleticism, social, curiosity, getArchetype());
    }
}
