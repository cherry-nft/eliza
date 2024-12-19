import { PatternData } from "./test-insert-example";

export const webDawPatterns = [
    {
        type: "layout",
        pattern_name: "Modern Dark Sequencer Grid",
        content: {
            // Exact HTML from production code
            html: `<div class="container">
    <h1>WebDAW.js Modern Sequencer</h1>
    <div class="sequencer" id="sequencer">
        <div class="sequencer-row">
            <div class="instrument-label">Kick</div>
            <div class="steps" id="kickSteps"></div>
        </div>
        <div class="sequencer-row">
            <div class="instrument-label">Snare</div>
            <div class="steps" id="snareSteps"></div>
        </div>
        <div class="sequencer-row">
            <div class="instrument-label">Hi-Hat Open</div>
            <div class="steps" id="hihatOpenSteps"></div>
        </div>
        <div class="sequencer-row">
            <div class="instrument-label">Hi-Hat Closed</div>
            <div class="steps" id="hihatClosedSteps"></div>
        </div>
    </div>
    <div class="tempo-control">
        <label for="tempo">Tempo:</label>
        <input type="range" id="tempo" min="60" max="180" value="120" />
        <span id="tempoValue">120 BPM</span>
    </div>
    <div class="controls">
        <button id="playPause">Play</button>
        <button id="stop">Stop</button>
        <button id="clearAll">Clear All</button>
    </div>
</div>`,
            // Exact CSS from production code
            css: `body {
    font-family: "Roboto", sans-serif;
    background-color: #121212;
    color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}
.container {
    background-color: #1e1e1e;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    width: 700px;
}
h1 {
    text-align: center;
    font-size: 2em;
    margin-bottom: 24px;
    color: #bb86fc;
}
.sequencer-row {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}
.instrument-label {
    width: 120px;
    text-align: right;
    margin-right: 20px;
    font-size: 1em;
    color: #03dac6;
}
.steps {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    flex-grow: 1;
}
.step {
    width: 50px;
    height: 50px;
    background-color: #2a2a2a;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-sizing: border-box;
}
.step.active {
    background-color: #bb86fc;
    box-shadow: 0 0 12px #bb86fc;
}
.step.current {
    border-color: #03dac6;
}
.controls {
    display: flex;
    justify-content: center;
    margin-top: 32px;
}
button {
    padding: 12px 24px;
    font-size: 1em;
    cursor: pointer;
    background-color: #03dac6;
    color: #000000;
    border: none;
    border-radius: 8px;
    margin: 0 8px;
    transition: all 0.3s ease;
}
button:hover {
    background-color: #018786;
    box-shadow: 0 4px 12px rgba(3, 218, 198, 0.3);
}
#clearAll {
    background-color: #cf6679;
}
#clearAll:hover {
    background-color: #b4505f;
    box-shadow: 0 4px 12px rgba(207, 102, 121, 0.3);
}
.tempo-control {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 24px;
}
.tempo-control label {
    margin-right: 12px;
    color: #03dac6;
}
input[type="range"] {
    -webkit-appearance: none;
    width: 200px;
    height: 4px;
    background: #2a2a2a;
    outline: none;
    opacity: 0.7;
    transition: opacity 0.2s;
}
input[type="range"]:hover {
    opacity: 1;
}
input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #bb86fc;
    cursor: pointer;
    border-radius: 50%;
}
input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #bb86fc;
    cursor: pointer;
    border-radius: 50%;
}`,
            context:
                "Production-proven dark mode sequencer interface with tempo control and step sequencing grid",
            metadata: {
                type: "sequencer_interface",
                theme: "dark",
                colors: {
                    primary: "#bb86fc",
                    secondary: "#03dac6",
                    background: "#121212",
                    surface: "#1e1e1e",
                },
                components: [
                    "sequencer_grid",
                    "tempo_slider",
                    "transport_controls",
                ],
                grid_size: {
                    rows: 4,
                    steps: 8,
                },
            },
        },
        room_id:
            "dark_theme_sequencer-music_grid_interface-" +
            "step_sequencer_layout-modern_music_ui-" +
            "drum_machine_interface-tempo_controlled_sequencer",
    },
    {
        type: "interaction",
        pattern_name: "Step Sequencer Core Logic",
        content: {
            js: `class Sequencer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
        this.currentStep = 0;
        this.tempo = 120;
        this.instruments = [
            { name: "kick", steps: Array(8).fill(false) },
            { name: "snare", steps: Array(8).fill(false) },
            { name: "hihatOpen", steps: Array(8).fill(false) },
            { name: "hihatClosed", steps: Array(8).fill(false) },
        ];

        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        this.instruments.forEach((instrument) => {
            const stepsEl = document.getElementById(
                \`\${instrument.name}Steps\`
            );
            instrument.steps.forEach((_, i) => {
                const button = document.createElement("button");
                button.classList.add("step");
                button.dataset.instrument = instrument.name;
                button.dataset.step = i;
                stepsEl.appendChild(button);
            });
        });
    }

    setupEventListeners() {
        document
            .getElementById("sequencer")
            .addEventListener("click", (e) => {
                if (e.target.classList.contains("step")) {
                    const instrument = e.target.dataset.instrument;
                    const step = parseInt(e.target.dataset.step);
                    this.toggleStep(instrument, step);
                }
            });

        document
            .getElementById("playPause")
            .addEventListener("click", () => this.togglePlay());
        document
            .getElementById("stop")
            .addEventListener("click", () => this.stop());
        document
            .getElementById("clearAll")
            .addEventListener("click", () => this.clearAll());

        const tempoSlider = document.getElementById("tempo");
        const tempoValue = document.getElementById("tempoValue");
        tempoSlider.addEventListener("input", (e) => {
            this.tempo = parseInt(e.target.value);
            tempoValue.textContent = \`\${this.tempo} BPM\`;
        });
    }

    toggleStep(instrument, step) {
        const instrumentObj = this.instruments.find(
            (i) => i.name === instrument
        );
        instrumentObj.steps[step] = !instrumentObj.steps[step];
        document
            .querySelector(
                \`[data-instrument="\${instrument}"][data-step="\${step}"]\`
            )
            .classList.toggle("active");
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        this.nextStepTime = this.audioContext.currentTime;
        this.scheduler();
        document.getElementById("playPause").textContent = "Pause";
    }

    pause() {
        this.isPlaying = false;
        document.getElementById("playPause").textContent = "Play";
    }

    stop() {
        this.isPlaying = false;
        this.currentStep = 0;
        document.getElementById("playPause").textContent = "Play";
        this.updateCurrentStepUI();
    }

    clearAll() {
        this.instruments.forEach((instrument) => {
            instrument.steps.fill(false);
        });
        document.querySelectorAll(".step").forEach((step) => {
            step.classList.remove("active");
        });
    }

    scheduler() {
        while (
            this.nextStepTime <
            this.audioContext.currentTime + 0.1
        ) {
            this.playCurrentStep();
            this.nextStep();
        }
        if (this.isPlaying) {
            requestAnimationFrame(() => this.scheduler());
        }
    }

    playCurrentStep() {
        this.instruments.forEach((instrument) => {
            if (instrument.steps[this.currentStep]) {
                this[
                    \`play\${instrument.name.charAt(0).toUpperCase() + instrument.name.slice(1)}\`
                ](this.nextStepTime);
            }
        });
        this.updateCurrentStepUI();
    }

    nextStep() {
        this.currentStep = (this.currentStep + 1) % 8;
        this.nextStepTime += 60 / this.tempo / 2; // sixteenth notes
    }

    updateCurrentStepUI() {
        document
            .querySelectorAll(".step")
            .forEach((step, index) => {
                step.classList.toggle(
                    "current",
                    index % 8 === this.currentStep
                );
            });
    }
}`,
            context:
                "Production-proven step sequencer core logic with tempo control and step management",
            metadata: {
                type: "sequencer_logic",
                features: [
                    "step_sequencing",
                    "tempo_control",
                    "play_pause",
                    "step_toggling",
                    "ui_sync",
                ],
                timing: "web_audio_based",
                grid_size: 8,
                instruments: 4,
            },
        },
        room_id:
            "step_sequencer_logic-music_timing-" +
            "drum_machine_core-sequencer_engine-" +
            "web_audio_timing-music_step_processor",
    },
    {
        type: "animation",
        pattern_name: "Web Audio Drum Synthesis",
        content: {
            js: `// Kick drum synthesis
playKick(time) {
    const osc = this.audioContext.createOscillator();
    const gainOsc = this.audioContext.createGain();
    const gainEnv = this.audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gainOsc.gain.setValueAtTime(1, time);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    gainEnv.gain.setValueAtTime(1, time);
    gainEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gainOsc).connect(gainEnv).connect(this.audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.5);
}

playSnare(time) {
    const noise = this.audioContext.createBufferSource();
    const noiseFilter = this.audioContext.createBiquadFilter();
    const noiseEnvelope = this.audioContext.createGain();
    const osc = this.audioContext.createOscillator();
    const oscEnvelope = this.audioContext.createGain();

    const bufferSize = this.audioContext.sampleRate * 0.5;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1000;
    noiseEnvelope.gain.setValueAtTime(1, time);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(100, time);
    oscEnvelope.gain.setValueAtTime(0.7, time);
    oscEnvelope.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.connect(noiseFilter).connect(noiseEnvelope);
    osc.connect(oscEnvelope);
    noiseEnvelope.connect(this.audioContext.destination);
    oscEnvelope.connect(this.audioContext.destination);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.2);
}

playHihatOpen(time) {
    this.playHihat(time, 0.3);
}

playHihatClosed(time) {
    this.playHihat(time, 0.1);
}

playHihat(time, duration) {
    const fundamental = 40;
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 10000;

    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 7000;

    const output = this.audioContext.createGain();
    output.gain.setValueAtTime(0.00001, time);
    output.gain.exponentialRampToValueAtTime(1, time + 0.02);
    output.gain.exponentialRampToValueAtTime(0.3, time + 0.03);
    output.gain.exponentialRampToValueAtTime(0.00001, time + duration);

    ratios.forEach((ratio) => {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = "square";
        osc.frequency.value = fundamental * ratio;
        gain.gain.value = 1 / ratios.length;

        osc.connect(gain)
            .connect(bandpass)
            .connect(highpass)
            .connect(output)
            .connect(this.audioContext.destination);
        osc.start(time);
        osc.stop(time + duration);
    });
}`,
            context:
                "Production-proven Web Audio API drum synthesis implementation",
            metadata: {
                type: "audio_synthesis",
                instruments: {
                    kick: "frequency_modulation",
                    snare: "noise_plus_tone",
                    hihat: "additive_synthesis",
                },
                technology: "web_audio_api",
                synthesis_types: [
                    "fm_synthesis",
                    "subtractive_synthesis",
                    "additive_synthesis",
                ],
            },
        },
        room_id:
            "web_audio_synthesis-drum_sounds-" +
            "audio_generation-sound_design-" +
            "drum_synthesis-percussion_audio",
    },
];

export type { PatternData };
