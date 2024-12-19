import { createClient } from "@supabase/supabase-js";
import { GamePattern } from "./types/patterns";
import {
    extractSemanticTags,
    encodeSemanticRoomId,
} from "./utils/semantic-utils";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(pattern: GamePattern): Promise<number[]> {
    const textToEmbed = `
        Pattern: ${pattern.pattern_name}
        Type: ${pattern.type}
        Description: ${pattern.content.context}
        HTML: ${pattern.content.html}
        ${pattern.content.css ? `CSS: ${pattern.content.css}` : ""}
        ${pattern.content.js ? `JS: ${pattern.content.js}` : ""}
        Metadata: ${JSON.stringify(pattern.content.metadata)}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertNightSynthPatterns() {
    // Piano Keyboard Pattern
    const keyboardPattern: GamePattern = {
        id: uuidv4(),
        type: "interaction",
        pattern_name: "Musical Keyboard Interface",
        content: {
            html: `<div class="keyboard" id="keyboard">
                <div class="key" data-note="a">A</div>
                <div class="key black" data-note="w">W</div>
                <div class="key" data-note="s">S</div>
                <div class="key black" data-note="e">E</div>
                <div class="key" data-note="d">D</div>
                <div class="key" data-note="f">F</div>
                <div class="key black" data-note="t">T</div>
                <div class="key" data-note="g">G</div>
                <div class="key black" data-note="y">Y</div>
                <div class="key" data-note="h">H</div>
                <div class="key black" data-note="u">U</div>
                <div class="key" data-note="j">J</div>
                <div class="key" data-note="k">K</div>
                <div class="key black" data-note="o">O</div>
                <div class="key" data-note="l">L</div>
                <div class="key black" data-note="p">P</div>
                <div class="key" data-note=";">;</div>
                <div class="key" data-note="'">'</div>
            </div>`,
            css: `.keyboard {
                display: flex;
                justify-content: center;
                margin-bottom: 20px;
            }
            .key {
                width: 40px;
                height: 150px;
                background-color: #000922;
                border: 1px solid #3366aa;
                display: flex;
                justify-content: center;
                align-items: flex-end;
                font-size: 0.9em;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
                padding-bottom: 5px;
            }
            .key.black {
                width: 25px;
                height: 90px;
                background-color: #000011;
                margin: 0 -12px;
                z-index: 1;
            }
            .key:hover {
                background-color: #001144;
            }
            .key.black:hover {
                background-color: #000033;
            }
            .key.active {
                background-color: #002266;
                transform: translateY(3px);
            }
            .key.black.active {
                background-color: #000055;
            }`,
            js: `document.addEventListener("keydown", (event) => {
                const key = event.key.toLowerCase();
                if (baseFrequencies[key.toUpperCase()] && !event.repeat)
                    noteOn(key);
                else if (key === "z") {
                    currentOctave = Math.max(0, currentOctave - 1);
                    octaveDisplay.textContent = \`Current Octave: \${currentOctave}\`;
                } else if (key === "x") {
                    currentOctave = Math.min(8, currentOctave + 1);
                    octaveDisplay.textContent = \`Current Octave: \${currentOctave}\`;
                }
            });

            document.addEventListener("keyup", (event) => {
                const key = event.key.toLowerCase();
                if (baseFrequencies[key.toUpperCase()]) noteOff(key);
            });`,
            context:
                "Interactive musical keyboard interface for a web-based synthesizer application",
            metadata: {
                interaction_type: "keyboard",
                visual_type: "interactive_keyboard",
                semantic_tags: {
                    use_cases: [
                        "music",
                        "synthesizer",
                        "piano",
                        "keyboard",
                        "midi",
                        "daw",
                        "melody",
                    ],
                    mechanics: [
                        "sound_generation",
                        "key_mapping",
                        "note_playing",
                        "octave_control",
                    ],
                    interactions: [
                        "keyboard_control",
                        "octave_switching",
                        "piano_keys",
                    ],
                    visual_style: [
                        "night_theme",
                        "piano_layout",
                        "keyboard_layout",
                    ],
                },
            },
        },
        embedding: [],
        effectiveness_score: 0.95,
        usage_count: 0,
        room_id:
            "piano_keyboard_music_synthesizer-note_playing_octave_control-keyboard_input_musical_keys-piano_layout_interactive_keys",
        user_id: "11111111-1111-1111-1111-111111111111",
        agent_id: "22222222-2222-2222-2222-222222222222",
    };

    // Sound Control Panel Pattern
    const controlPanelPattern: GamePattern = {
        id: uuidv4(),
        type: "interaction",
        pattern_name: "Sound Control Interface",
        content: {
            html: `<div class="controls">
                <div class="control">
                    <label for="waveform">Waveform</label>
                    <select id="waveform">
                        <option value="sawtooth">Sawtooth</option>
                        <option value="square">Square</option>
                        <option value="triangle">Triangle</option>
                        <option value="sine">Sine</option>
                    </select>
                    <div class="lock-button" data-control="waveform"></div>
                </div>
                <div class="control">
                    <label for="cutoff">Cutoff</label>
                    <input type="range" min="20" max="20000" value="5000" class="slider" id="cutoff" />
                    <div class="lock-button" data-control="cutoff"></div>
                </div>
                <div class="control">
                    <label for="resonance">Resonance</label>
                    <input type="range" min="0" max="30" value="5" class="slider" id="resonance" />
                    <div class="lock-button" data-control="resonance"></div>
                </div>
                <div class="control">
                    <label for="attack">Attack</label>
                    <input type="range" min="0.01" max="2" value="0.1" step="0.01" class="slider" id="attack" />
                    <div class="lock-button" data-control="attack"></div>
                </div>
                <div class="control">
                    <label for="decay">Decay</label>
                    <input type="range" min="0.01" max="2" value="0.1" step="0.01" class="slider" id="decay" />
                    <div class="lock-button" data-control="decay"></div>
                </div>
                <div class="control">
                    <label for="sustain">Sustain</label>
                    <input type="range" min="0" max="1" value="0.5" step="0.01" class="slider" id="sustain" />
                    <div class="lock-button" data-control="sustain"></div>
                </div>
                <div class="control">
                    <label for="release">Release</label>
                    <input type="range" min="0.01" max="5" value="0.5" step="0.01" class="slider" id="release" />
                    <div class="lock-button" data-control="release"></div>
                </div>
                <div class="control">
                    <label for="glide">Glide</label>
                    <input type="range" min="0" max="1" value="0" step="0.01" class="slider" id="glide" />
                    <div class="lock-button" data-control="glide"></div>
                </div>
                <div class="control">
                    <label for="echo">Echo</label>
                    <input type="range" min="0" max="1" value="0.3" step="0.01" class="slider" id="echo" />
                    <div class="lock-button" data-control="echo"></div>
                </div>
                <div class="control">
                    <label for="detune">Detune</label>
                    <input type="range" min="-100" max="100" value="0" step="1" class="slider" id="detune" />
                    <div class="lock-button" data-control="detune"></div>
                </div>
                <div class="control">
                    <label for="vibrato">Vibrato</label>
                    <input type="range" min="0" max="20" value="0" step="0.1" class="slider" id="vibrato" />
                    <div class="lock-button" data-control="vibrato"></div>
                </div>
                <div class="control">
                    <label for="volume">Volume</label>
                    <input type="range" min="0" max="1" value="0.7" step="0.01" class="slider" id="volume" />
                    <div class="lock-button" data-control="volume"></div>
                </div>
                <div class="control">
                    <label for="modulation">Modulation</label>
                    <input type="range" min="0" max="100" value="0" step="1" class="slider" id="modulation" />
                    <div class="lock-button" data-control="modulation"></div>
                </div>
                <div class="control">
                    <label for="harmonics">Harmonics</label>
                    <input type="range" min="1" max="10" value="1" step="1" class="slider" id="harmonics" />
                    <div class="lock-button" data-control="harmonics"></div>
                </div>
            </div>`,
            css: `.controls {
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
                margin-bottom: 20px;
            }
            .control {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: 10px;
            }
            .control label {
                margin-bottom: 5px;
            }
            .slider {
                -webkit-appearance: none;
                width: 150px;
                height: 8px;
                border-radius: 4px;
                background: #000922;
                outline: none;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            .slider:hover {
                opacity: 1;
            }
            .slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #3366aa;
                cursor: pointer;
            }
            .slider::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #3366aa;
                cursor: pointer;
            }
            select {
                background-color: #000922;
                color: #3366aa;
                border: 1px solid #3366aa;
                padding: 5px;
                font-family: "Courier New", monospace;
            }
            .lock-button {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background-color: #000922;
                border: 2px solid #3366aa;
                cursor: pointer;
                margin-left: 5px;
                transition: all 0.3s ease;
            }
            .lock-button.locked {
                background-color: #3366aa;
                box-shadow: 0 0 10px #3366aa;
            }`,
            js: `Object.values(controls).forEach((control) => {
                control.addEventListener("input", () => updateControl(control));
            });

            const lockButtons = document.querySelectorAll(".lock-button");
            lockButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    button.classList.toggle("locked");
                });
            });`,
            context:
                "Sound parameter control interface for a synthesizer with lockable controls",
            metadata: {
                interaction_type: "slider",
                visual_type: "control_panel",
                semantic_tags: {
                    use_cases: [
                        "sound_control",
                        "synthesizer",
                        "daw",
                        "sound_design",
                        "music_production",
                    ],
                    mechanics: [
                        "parameter_control",
                        "value_locking",
                        "sound_shaping",
                        "modulation",
                    ],
                    interactions: [
                        "slider_control",
                        "button_toggle",
                        "parameter_adjustment",
                    ],
                    visual_style: [
                        "night_theme",
                        "minimal_controls",
                        "studio_interface",
                    ],
                },
            },
        },
        embedding: [],
        effectiveness_score: 0.92,
        usage_count: 0,
        room_id:
            "sound_control_audio_effects_synthesizer-parameter_control_sound_shaping-sliders_knobs_controls-control_panel_night_theme",
        user_id: "11111111-1111-1111-1111-111111111111",
        agent_id: "22222222-2222-2222-2222-222222222222",
    };

    // Waveform Visualization Pattern
    const waveformPattern: GamePattern = {
        id: uuidv4(),
        type: "animation",
        pattern_name: "Audio Waveform Visualization",
        content: {
            html: `<canvas id="background-canvas"></canvas>`,
            css: `#background-canvas {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
            }`,
            js: `function drawBackgroundAnimation() {
                requestAnimationFrame(drawBackgroundAnimation);
                analyser.getByteTimeDomainData(dataArray);

                bgCtx.fillStyle = "rgba(0, 0, 17, 0.1)";
                bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

                bgCtx.lineWidth = 2;
                bgCtx.strokeStyle = "rgba(51, 102, 170, 0.5)";
                bgCtx.beginPath();

                const sliceWidth = (backgroundCanvas.width * 1.0) / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0 - 1;
                    const y = (v * backgroundCanvas.height) / 4 + backgroundCanvas.height / 2;

                    if (i === 0) {
                        bgCtx.moveTo(x, y);
                    } else {
                        bgCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                bgCtx.lineTo(backgroundCanvas.width, backgroundCanvas.height / 2);
                bgCtx.stroke();
            }`,
            context:
                "Real-time audio waveform visualization with smooth animation",
            metadata: {
                visual_type: "waveform",
                animation_duration: "continuous",
                semantic_tags: {
                    use_cases: [
                        "audio_visualization",
                        "background_animation",
                        "waveform",
                        "sound_wave",
                        "beats",
                    ],
                    mechanics: [
                        "real_time_rendering",
                        "audio_analysis",
                        "wave_visualization",
                    ],
                    interactions: ["audio_reactive", "sound_responsive"],
                    visual_style: [
                        "night_theme",
                        "waveform",
                        "animated",
                        "oscilloscope",
                    ],
                },
            },
        },
        embedding: [],
        effectiveness_score: 0.94,
        usage_count: 0,
        room_id:
            "audio_visualization_waveform_sound_wave-real_time_audio_analysis-audio_reactive-animated_wave_oscilloscope",
        user_id: "11111111-1111-1111-1111-111111111111",
        agent_id: "22222222-2222-2222-2222-222222222222",
    };

    // Sound Synthesis Engine Pattern
    const synthesisPattern: GamePattern = {
        id: uuidv4(),
        type: "animation",
        pattern_name: "Audio Synthesis Engine",
        content: {
            html: "",
            js: `function createSynthSound(frequency) {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();

                oscillator.type = controls.waveform.value;
                oscillator.detune.setValueAtTime(
                    parseFloat(controls.detune.value),
                    audioContext.currentTime
                );

                const glideTime = parseFloat(controls.glide.value);
                if (lastFrequency !== null && glideTime > 0) {
                    oscillator.frequency.setValueAtTime(
                        lastFrequency,
                        audioContext.currentTime
                    );
                    oscillator.frequency.exponentialRampToValueAtTime(
                        frequency,
                        audioContext.currentTime + glideTime
                    );
                } else {
                    oscillator.frequency.setValueAtTime(
                        frequency,
                        audioContext.currentTime
                    );
                }

                lastFrequency = frequency;

                filter.type = "lowpass";
                filter.frequency.value = controls.cutoff.value;
                filter.Q.value = controls.resonance.value;

                const attack = parseFloat(controls.attack.value);
                const decay = parseFloat(controls.decay.value);
                const sustain = parseFloat(controls.sustain.value);
                const release = parseFloat(controls.release.value);

                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(
                    1,
                    audioContext.currentTime + attack
                );
                gainNode.gain.linearRampToValueAtTime(
                    sustain,
                    audioContext.currentTime + attack + decay
                );

                const vibratoFreq = parseFloat(controls.vibrato.value);
                if (vibratoFreq > 0) {
                    const vibrato = audioContext.createOscillator();
                    const vibratoGain = audioContext.createGain();
                    vibrato.frequency.setValueAtTime(
                        vibratoFreq,
                        audioContext.currentTime
                    );
                    vibratoGain.gain.setValueAtTime(
                        5,
                        audioContext.currentTime
                    );
                    vibrato.connect(vibratoGain);
                    vibratoGain.connect(oscillator.frequency);
                    vibrato.start();
                }

                // Add modulation
                const modulationAmount = parseFloat(controls.modulation.value);
                if (modulationAmount > 0) {
                    const modulator = audioContext.createOscillator();
                    const modulatorGain = audioContext.createGain();
                    modulator.frequency.setValueAtTime(
                        frequency * 0.5,
                        audioContext.currentTime
                    );
                    modulatorGain.gain.setValueAtTime(
                        modulationAmount,
                        audioContext.currentTime
                    );
                    modulator.connect(modulatorGain);
                    modulatorGain.connect(oscillator.frequency);
                    modulator.start();
                }

                // Add harmonics
                const harmonicsCount = parseInt(controls.harmonics.value);
                if (harmonicsCount > 1) {
                    for (let i = 2; i <= harmonicsCount; i++) {
                        const harmonic = audioContext.createOscillator();
                        const harmonicGain = audioContext.createGain();
                        harmonic.frequency.setValueAtTime(
                            frequency * i,
                            audioContext.currentTime
                        );
                        harmonicGain.gain.setValueAtTime(
                            1 / (i * 2),
                            audioContext.currentTime
                        );
                        harmonic.connect(harmonicGain);
                        harmonicGain.connect(filter);
                        harmonic.start();
                    }
                }

                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(masterGain);

                oscillator.start();

                return { oscillator, gainNode, filter };
            }`,
            context:
                "Core audio synthesis engine with ADSR envelope, filters, and modulation",
            metadata: {
                interaction_type: "audio",
                semantic_tags: {
                    use_cases: [
                        "sound_synthesis",
                        "audio_processing",
                        "sound_design",
                        "music_production",
                        "harmony",
                    ],
                    mechanics: [
                        "oscillator",
                        "envelope",
                        "filtering",
                        "adsr",
                        "synthesis",
                    ],
                    interactions: [
                        "parameter_modulation",
                        "sound_shaping",
                        "audio_control",
                    ],
                    visual_style: ["audio_engine", "synthesizer_core"],
                },
            },
        },
        embedding: [],
        effectiveness_score: 0.96,
        usage_count: 0,
        room_id:
            "sound_synthesis_audio_engine_synthesizer-oscillator_filter_envelope-modulation_effects-audio_engine",
        user_id: "11111111-1111-1111-1111-111111111111",
        agent_id: "22222222-2222-2222-2222-222222222222",
    };

    // Night Theme Styling Pattern
    const themePattern: GamePattern = {
        id: uuidv4(),
        type: "style",
        pattern_name: "Night Synth Theme",
        content: {
            html: `<div class="container">
                <h1>Night Synth</h1>
                <div id="octave-display">Current Octave: 4</div>
            </div>`,
            css: `body {
                font-family: "Courier New", monospace;
                background-color: #000011;
                color: #3366aa;
                margin: 0;
                padding: 20px;
                overflow: hidden;
            }
            .container {
                max-width: 1000px;
                margin: 0 auto;
                position: relative;
                z-index: 1;
            }
            h1 {
                text-align: center;
                font-size: 3em;
                margin-bottom: 20px;
                text-shadow: 0 0 10px #3366aa;
            }`,
            context:
                "Dark theme optimized for night-time usage with blue accent colors",
            metadata: {
                visual_type: "night_theme",
                color_scheme: ["#000011", "#3366aa"],
                semantic_tags: {
                    use_cases: [
                        "dark_mode",
                        "night_friendly",
                        "music_interface",
                        "studio_theme",
                    ],
                    mechanics: ["theme_styling", "visual_design"],
                    interactions: [],
                    visual_style: [
                        "night_theme",
                        "monospace",
                        "glow_effect",
                        "dark_interface",
                        "blue_accent",
                        "midnight",
                        "dark_mode",
                    ],
                },
            },
        },
        embedding: [],
        effectiveness_score: 0.93,
        usage_count: 0,
        room_id:
            "dark_mode_night_theme-theme_styling-visual_feedback-dark_blue_accent_glow",
        user_id: "11111111-1111-1111-1111-111111111111",
        agent_id: "22222222-2222-2222-2222-222222222222",
    };

    const patterns = [
        keyboardPattern,
        controlPanelPattern,
        waveformPattern,
        synthesisPattern,
        themePattern,
    ];

    // Extract and encode semantic tags for each pattern
    for (const pattern of patterns) {
        try {
            // Check if pattern with this room_id already exists
            const { data: existingPatterns, error: searchError } =
                await supabase
                    .from("vector_patterns")
                    .select("id, room_id")
                    .eq("room_id", pattern.room_id);

            if (searchError) throw searchError;

            if (existingPatterns && existingPatterns.length > 0) {
                console.log(
                    `Pattern with room_id ${pattern.room_id} already exists, skipping...`
                );
                continue;
            }

            // Generate embedding using OpenAI
            pattern.embedding = await generateEmbedding(pattern);

            // Extract semantic tags but don't modify room_id
            const tags = extractSemanticTags(pattern);
            console.log(`Semantic tags for ${pattern.pattern_name}:`, tags);

            const { error } = await supabase
                .from("vector_patterns")
                .insert(pattern);
            if (error) throw error;

            console.log(
                `Successfully inserted pattern: ${pattern.pattern_name}`
            );
        } catch (error) {
            console.error(
                `Error inserting pattern ${pattern.pattern_name}:`,
                error
            );
        }
    }
}

insertNightSynthPatterns().catch(console.error);
