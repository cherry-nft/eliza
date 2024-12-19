import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://drhgdchrqzidfmhgekva.supabase.co";
const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pattern-specific room IDs based on semantic analysis
const patternRoomIds = {
    "Advanced Vehicle Movement System":
        "vehicle_movement_physics_racing-car_drift_momentum_control-smooth_acceleration_steering_mechanics-friction_velocity_dynamic_handling",
    "Intelligent Police AI System":
        "police_pursuit_ai_chase-cop_patrol_intelligent_behavior-pursuit_patterns_dynamic_movement-law_enforcement_tactical_strategy",
    "Dynamic Trail System":
        "visual_effects_trail_rendering-particle_system_motion_tracks-speed_based_effects_animation-drift_marks_dynamic_trails",
    "Explosion and Impact Effects":
        "explosion_effects_particle_system-impact_visual_feedback_animation-screen_shake_audio_effects-blast_radius_dynamic_particles",
    "Advanced Game Modes System":
        "game_modes_menu_interface-gameplay_variation_selection-mode_switching_game_types-survival_maze_timetrials_classic",
    "Police Siren Alarm Audio System":
        "audio_synthesis_siren_effects-police_sound_system_alerts-dynamic_sound_generation_feedback-emergency_audio_warning_system",
};

async function updateGeometryRushRoomIds() {
    try {
        // Get all Geometry Rush patterns by the dummy room ID
        const { data: patterns, error } = await supabase
            .from("vector_patterns")
            .select("id, pattern_name")
            .eq("room_id", "00000000-0000-0000-0000-000000000000");

        if (error) {
            console.error("Error fetching Geometry Rush patterns:", error);
            return;
        }

        if (!patterns || patterns.length === 0) {
            console.log("No Geometry Rush patterns found with dummy room ID");
            return;
        }

        console.log(
            `Found ${patterns.length} Geometry Rush patterns to update`
        );

        // Update each pattern with its specific room ID
        for (const pattern of patterns) {
            const roomId = patternRoomIds[pattern.pattern_name];
            if (!roomId) {
                console.warn(
                    `No room ID defined for pattern: ${pattern.pattern_name}`
                );
                continue;
            }

            const { error: updateError } = await supabase
                .from("vector_patterns")
                .update({ room_id: roomId })
                .eq("id", pattern.id);

            if (updateError) {
                console.error(
                    `Error updating pattern ${pattern.pattern_name}:`,
                    updateError
                );
            } else {
                console.log(
                    `Updated room ID for pattern: ${pattern.pattern_name}`
                );
            }
        }

        console.log("Finished updating room IDs");
    } catch (err) {
        console.error("Error in updateGeometryRushRoomIds:", err);
    }
}

updateGeometryRushRoomIds();
