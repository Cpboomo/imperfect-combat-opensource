/**
 * engine-audio.js — 音频引擎层
 * @module engine-audio
 * @description Web Audio API sound engine with synthetic sound generation.
 *   Provides click, shatter, pickup, card-flip and other mechanical feedback sounds.
 *   Includes volume control and mute toggle.
 *   All sound generators are self-contained — no external audio files needed.
 *   Depends on: engine-core.js (must be loaded before this file).
 */
'use strict';

// ==================== 音频配置 ====================

/** Audio configuration constants */
var AUDIO_CONFIG = {
    /** Default master volume (0–1) */
    DEFAULT_VOLUME: 0.5,

    /** AudioContext sample rate (set at init) */
    SAMPLE_RATE: 44100
};

// ==================== 音频状态 ====================

/** Internal audio engine state */
var audioState = {
    /** Web Audio API context */
    ctx: null,

    /** Master gain node */
    masterGain: null,

    /** Is audio initialized? */
    initialized: false,

    /** Mute flag */
    muted: false,

    /** Saved volume before muting */
    _volumeBeforeMute: AUDIO_CONFIG.DEFAULT_VOLUME
};

// ==================== 初始化 ====================

/**
 * Initialize the audio engine.
 * Creates AudioContext and master gain node.
 * Must be called after a user interaction (click/touch) due to browser autoplay policy.
 *
 * @returns {boolean} True if initialized successfully
 */
function audioInit() {
    if (audioState.initialized) return true;

    try {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('[engine-audio] Web Audio API not supported');
            return false;
        }

        audioState.ctx = new AudioContext();
        audioState.masterGain = audioState.ctx.createGain();
        audioState.masterGain.gain.value = AUDIO_CONFIG.DEFAULT_VOLUME;
        audioState.masterGain.connect(audioState.ctx.destination);

        audioState.initialized = true;
        return true;
    } catch (e) {
        console.warn('[engine-audio] Failed to init AudioContext:', e.message);
        return false;
    }
}

/**
 * Ensure audio context is resumed (required after user gesture on some browsers).
 */
function audioEnsureResumed() {
    if (audioState.ctx && audioState.ctx.state === 'suspended') {
        audioState.ctx.resume();
    }
}

// ==================== 音量控制 ====================

/**
 * Set master volume.
 *
 * @param {number} vol - Volume 0–1
 */
function audioSetVolume(vol) {
    vol = clamp(vol, 0, 1);
    if (audioState.masterGain) {
        audioState.masterGain.gain.value = vol;
    }
    if (!audioState.muted) {
        audioState._volumeBeforeMute = vol;
    }
}

/**
 * Get current volume.
 *
 * @returns {number} 0–1
 */
function audioGetVolume() {
    return audioState.muted ? 0 : (audioState.masterGain ? audioState.masterGain.gain.value : 0);
}

/**
 * Toggle mute on/off.
 *
 * @param {boolean} [force] - Force mute state (true = mute, false = unmute). Omit to toggle.
 * @returns {boolean} New mute state
 */
function audioToggleMute(force) {
    if (typeof force === 'boolean') {
        audioState.muted = force;
    } else {
        audioState.muted = !audioState.muted;
    }

    if (audioState.muted) {
        audioState._volumeBeforeMute = audioState.masterGain ? audioState.masterGain.gain.value : AUDIO_CONFIG.DEFAULT_VOLUME;
        if (audioState.masterGain) audioState.masterGain.gain.value = 0;
    } else {
        if (audioState.masterGain) audioState.masterGain.gain.value = audioState._volumeBeforeMute;
    }

    return audioState.muted;
}

/**
 * Check if audio is currently muted.
 *
 * @returns {boolean}
 */
function audioIsMuted() {
    return audioState.muted;
}

// ==================== 合成音效 ====================

/**
 * Play a short synthesized tone.
 *
 * @param {object} params
 * @param {number} [params.freq=440]    - Frequency in Hz
 * @param {number} [params.duration=0.1] - Duration in seconds
 * @param {string} [params.type='sine']  - Oscillator type (sine, square, sawtooth, triangle)
 * @param {number} [params.volume=0.3]   - Volume 0–1
 * @param {number} [params.freqEnd]      - End frequency (for sweeps)
 */
function audioSynthTone(params) {
    if (!audioState.ctx || audioState.muted) return;

    params = params || {};
    var freq = params.freq || 440;
    var duration = params.duration || 0.1;
    var type = params.type || 'sine';
    var vol = (params.volume !== undefined ? params.volume : 0.3);

    var now = audioState.ctx.currentTime;

    var osc = audioState.ctx.createOscillator();
    var gain = audioState.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // Frequency sweep
    if (params.freqEnd) {
        osc.frequency.linearRampToValueAtTime(params.freqEnd, now + duration);
    }

    // Volume envelope: quick attack, quick release
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(audioState.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
}

/**
 * Play a noise burst (for impact/explosion sounds).
 *
 * @param {object} params
 * @param {number} [params.duration=0.15] - Duration in seconds
 * @param {number} [params.volume=0.3]    - Volume 0–1
 * @param {number} [params.filterFreq=2000] - Low-pass filter cutoff Hz
 */
function audioSynthNoise(params) {
    if (!audioState.ctx || audioState.muted) return;

    params = params || {};
    var duration = params.duration || 0.15;
    var vol = (params.volume !== undefined ? params.volume : 0.3);
    var filterFreq = params.filterFreq || 2000;

    var now = audioState.ctx.currentTime;

    // Create noise buffer
    var bufferSize = Math.floor(audioState.ctx.sampleRate * duration);
    var buffer = audioState.ctx.createBuffer(1, bufferSize, audioState.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // Linear decay
    }

    var source = audioState.ctx.createBufferSource();
    source.buffer = buffer;

    var filter = audioState.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    var gain = audioState.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioState.masterGain);

    source.start(now);
    source.stop(now + duration + 0.01);
}

// ==================== 游戏音效 ====================

/**
 * Click sound (咔哒) — mechanical card/button click.
 * Short high-frequency tick.
 */
function audioPlayClick() {
    audioSynthTone({ freq: 1200, freqEnd: 800, duration: 0.06, type: 'square', volume: 0.2 });
    audioSynthNoise({ duration: 0.03, volume: 0.1, filterFreq: 4000 });
}

/**
 * Shatter sound (碎裂) — breaking/glass shatter.
 * Noise burst with descending tone.
 */
function audioPlayShatter() {
    audioSynthNoise({ duration: 0.2, volume: 0.3, filterFreq: 6000 });
    audioSynthTone({ freq: 2400, freqEnd: 200, duration: 0.25, type: 'sawtooth', volume: 0.15 });
}

/**
 * Pickup sound (拾取) — item collection.
 * Rising two-note chime.
 */
function audioPlayPickup() {
    audioSynthTone({ freq: 880,  duration: 0.08, type: 'sine', volume: 0.25 });
    setTimeout(function() {
        audioSynthTone({ freq: 1320, duration: 0.12, type: 'sine', volume: 0.25 });
    }, 80);
}

/**
 * Card flip sound — card being turned over.
 * Quick mid-frequency tap.
 */
function audioPlayCardFlip() {
    audioSynthTone({ freq: 600, freqEnd: 1000, duration: 0.08, type: 'triangle', volume: 0.2 });
    audioSynthNoise({ duration: 0.02, volume: 0.08, filterFreq: 3000 });
}

/**
 * Card select sound — choosing/confirming a card.
 * Assertive two-tone ascending chime.
 */
function audioPlayCardSelect() {
    audioSynthTone({ freq: 660,  duration: 0.1, type: 'sine', volume: 0.3 });
    setTimeout(function() {
        audioSynthTone({ freq: 990, duration: 0.15, type: 'sine', volume: 0.3 });
    }, 100);
}

/**
 * Hit sound — weapon impact on enemy.
 * Low thud with noise.
 */
function audioPlayHit() {
    audioSynthTone({ freq: 150, freqEnd: 60, duration: 0.12, type: 'sine', volume: 0.25 });
    audioSynthNoise({ duration: 0.08, volume: 0.2, filterFreq: 800 });
}

/**
 * Critical hit sound — extra punchy impact.
 * Higher intensity hit.
 */
function audioPlayCritHit() {
    audioSynthTone({ freq: 80, freqEnd: 40, duration: 0.15, type: 'sawtooth', volume: 0.3 });
    audioSynthNoise({ duration: 0.1, volume: 0.35, filterFreq: 3000 });
}

/**
 * Dash sound — player dash/evade.
 * Quick whoosh with descending pitch.
 */
function audioPlayDash() {
    audioSynthNoise({ duration: 0.15, volume: 0.15, filterFreq: 3000 });
    audioSynthTone({ freq: 800, freqEnd: 300, duration: 0.12, type: 'sine', volume: 0.2 });
}

/**
 * Damage taken sound — player getting hurt.
 * Low dull thud.
 */
function audioPlayDamage() {
    audioSynthTone({ freq: 200, freqEnd: 50, duration: 0.2, type: 'sawtooth', volume: 0.2 });
    audioSynthTone({ freq: 100, duration: 0.1, type: 'square', volume: 0.15 });
}

/**
 * Enemy death sound — monster dying.
 * Descending buzzy tone.
 */
function audioPlayEnemyDeath() {
    audioSynthNoise({ duration: 0.15, volume: 0.2, filterFreq: 3000 });
    audioSynthTone({ freq: 500, freqEnd: 100, duration: 0.2, type: 'sawtooth', volume: 0.15 });
}

/**
 * Wave start sound — new wave incoming.
 * Ascending alert tone sequence.
 */
function audioPlayWaveStart() {
    for (var i = 0; i < 3; i++) {
        (function(idx) {
            setTimeout(function() {
                audioSynthTone({ freq: 440 + idx * 220, duration: 0.15, type: 'sine', volume: 0.25 });
            }, idx * 180);
        })(i);
    }
}

/**
 * Level up / upgrade sound — ascending celebration.
 * Rising triplet chime.
 */
function audioPlayLevelUp() {
    var notes = [523, 659, 784]; // C5, E5, G5
    for (var i = 0; i < notes.length; i++) {
        (function(idx) {
            setTimeout(function() {
                audioSynthTone({ freq: notes[idx], duration: 0.2, type: 'sine', volume: 0.3 });
            }, idx * 100);
        })(i);
    }
}

/**
 * Game over sound — descending minor chord.
 * Slow descending tone.
 */
function audioPlayGameOver() {
    audioSynthTone({ freq: 440, freqEnd: 110, duration: 0.8, type: 'sawtooth', volume: 0.25 });
    setTimeout(function() {
        audioSynthTone({ freq: 330, freqEnd: 82, duration: 0.8, type: 'sawtooth', volume: 0.2 });
    }, 200);
}

/**
 * UI hover/scroll sound — light tick.
 * Very subtle click.
 */
function audioPlayUIHover() {
    audioSynthTone({ freq: 1800, duration: 0.03, type: 'sine', volume: 0.1 });
}

// ==================== 声音池 (预加载) ====================

/**
 * Pre-load a named sound into the pool.
 * Since all sounds are synthesized on demand, the "pool" just registers
 * that the sound is available. This function exists for API compatibility
 * with future audio-file-based implementations.
 *
 * @param {string} name - Sound name (e.g. 'click', 'pickup')
 */

function audioPoolPreload(name) {
    // No-op for synth-based system — sounds are generated on the fly.
    // In a future version, this could pre-decode audio files.
}

/**
 * Play a sound by name from the pool.
 *
 * @param {string} name - Sound name
 * @returns {boolean} True if the sound was played
 */
function audioPoolPlay(name) {
    // Map names to play functions
    var map = {
        'click':       audioPlayClick,
        'shatter':     audioPlayShatter,
        'pickup':      audioPlayPickup,
        'card_flip':   audioPlayCardFlip,
        'card_flip_reverse': audioPlayCardFlip,  // alias
        'card_select': audioPlayCardSelect,
        'hit':         audioPlayHit,
        'crit_hit':    audioPlayCritHit,
        'dash':        audioPlayDash,
        'damage':      audioPlayDamage,
        'enemy_death': audioPlayEnemyDeath,
        'wave_start':  audioPlayWaveStart,
        'level_up':    audioPlayLevelUp,
        'game_over':   audioPlayGameOver,
        'ui_hover':    audioPlayUIHover
    };

    var fn = map[name];
    if (fn) {
        audioEnsureResumed();
        fn();
        return true;
    }
    console.warn('[engine-audio] Unknown sound: ' + name);
    return false;
}

// ==================== 调试 ====================

/**
 * Test all sound effects (for debugging).
 * Plays each sound in sequence with a short delay.
 */
function audioDebugTestAll() {
    if (!audioState.initialized) {
        console.warn('[engine-audio] Not initialized. Call audioInit() first after user gesture.');
        return;
    }

    audioEnsureResumed();
    var sounds = ['click', 'shatter', 'pickup', 'card_flip', 'card_select', 'hit', 'crit_hit', 'dash', 'damage', 'enemy_death'];
    sounds.forEach(function(name, i) {
        setTimeout(function() {
            console.log('[engine-audio] Playing:', name);
            audioPoolPlay(name);
        }, i * 400);
    });
}
