/**
 * Cute, varied built-in alarm melodies (Web Audio). Each sound has multiple
 * variants so loops do not repeat the same pattern every time.
 */

/** @typedef {{ freq: number, at: number, dur: number, type?: OscillatorType, vol?: number }} MelodyNote */

/** @type {Record<string, MelodyNote[][]>} */
export const ALARM_MELODY_VARIANTS = {
  default: [
    [
      { freq: 784, at: 0, dur: 0.16, type: "square", vol: 0.22 },
      { freq: 988, at: 0.2, dur: 0.16, type: "square", vol: 0.22 },
      { freq: 784, at: 0.42, dur: 0.16, type: "square", vol: 0.22 },
      { freq: 988, at: 0.62, dur: 0.16, type: "square", vol: 0.22 },
      { freq: 784, at: 0.84, dur: 0.16, type: "square", vol: 0.24 },
      { freq: 988, at: 1.04, dur: 0.18, type: "square", vol: 0.24 },
    ],
    [
      { freq: 660, at: 0, dur: 0.14, type: "square", vol: 0.2 },
      { freq: 880, at: 0.18, dur: 0.14, type: "square", vol: 0.2 },
      { freq: 660, at: 0.38, dur: 0.14, type: "square", vol: 0.2 },
      { freq: 880, at: 0.56, dur: 0.14, type: "square", vol: 0.22 },
      { freq: 660, at: 0.76, dur: 0.14, type: "square", vol: 0.22 },
      { freq: 880, at: 0.94, dur: 0.16, type: "square", vol: 0.24 },
    ],
    [
      { freq: 880, at: 0, dur: 0.12, type: "square", vol: 0.21 },
      { freq: 1109, at: 0.14, dur: 0.12, type: "square", vol: 0.21 },
      { freq: 880, at: 0.3, dur: 0.12, type: "square", vol: 0.21 },
      { freq: 1109, at: 0.44, dur: 0.12, type: "square", vol: 0.23 },
      { freq: 880, at: 0.6, dur: 0.12, type: "square", vol: 0.23 },
      { freq: 1109, at: 0.74, dur: 0.14, type: "square", vol: 0.25 },
    ],
  ],
  chime: [
    [
      { freq: 1318, at: 0, dur: 0.55, type: "sine", vol: 0.08 },
      { freq: 1568, at: 0.35, dur: 0.5, type: "sine", vol: 0.07 },
      { freq: 1760, at: 0.7, dur: 0.65, type: "triangle", vol: 0.09 },
      { freq: 2093, at: 1.1, dur: 0.7, type: "sine", vol: 0.06 },
    ],
    [
      { freq: 1047, at: 0, dur: 0.45, type: "triangle", vol: 0.09 },
      { freq: 1175, at: 0.28, dur: 0.5, type: "sine", vol: 0.08 },
      { freq: 1319, at: 0.55, dur: 0.55, type: "sine", vol: 0.09 },
      { freq: 1568, at: 0.9, dur: 0.75, type: "triangle", vol: 0.07 },
    ],
    [
      { freq: 988, at: 0, dur: 0.4, type: "sine", vol: 0.08 },
      { freq: 1245, at: 0.25, dur: 0.45, type: "sine", vol: 0.09 },
      { freq: 1480, at: 0.6, dur: 0.5, type: "triangle", vol: 0.08 },
      { freq: 1976, at: 1.0, dur: 0.8, type: "sine", vol: 0.06 },
    ],
  ],
  bells: [
    [
      { freq: 523, at: 0, dur: 0.35, type: "triangle", vol: 0.12 },
      { freq: 659, at: 0.2, dur: 0.32, type: "triangle", vol: 0.11 },
      { freq: 784, at: 0.38, dur: 0.3, type: "sine", vol: 0.1 },
      { freq: 1047, at: 0.58, dur: 0.4, type: "triangle", vol: 0.13 },
      { freq: 1319, at: 0.85, dur: 0.45, type: "triangle", vol: 0.1 },
    ],
    [
      { freq: 440, at: 0, dur: 0.3, type: "triangle", vol: 0.11 },
      { freq: 554, at: 0.15, dur: 0.28, type: "triangle", vol: 0.1 },
      { freq: 659, at: 0.32, dur: 0.32, type: "sine", vol: 0.11 },
      { freq: 880, at: 0.55, dur: 0.38, type: "triangle", vol: 0.12 },
    ],
    [
      { freq: 587, at: 0, dur: 0.28, type: "triangle", vol: 0.1 },
      { freq: 740, at: 0.18, dur: 0.35, type: "triangle", vol: 0.11 },
      { freq: 988, at: 0.45, dur: 0.42, type: "sine", vol: 0.12 },
      { freq: 1175, at: 0.75, dur: 0.5, type: "triangle", vol: 0.1 },
    ],
  ],
  digital: [
    [
      { freq: 990, at: 0, dur: 0.1, type: "square", vol: 0.2 },
      { freq: 1320, at: 0.12, dur: 0.1, type: "square", vol: 0.2 },
      { freq: 990, at: 0.26, dur: 0.1, type: "square", vol: 0.2 },
      { freq: 1320, at: 0.38, dur: 0.1, type: "square", vol: 0.22 },
      { freq: 990, at: 0.52, dur: 0.1, type: "square", vol: 0.22 },
      { freq: 1320, at: 0.64, dur: 0.12, type: "square", vol: 0.24 },
      { freq: 990, at: 0.8, dur: 0.1, type: "square", vol: 0.24 },
      { freq: 1320, at: 0.92, dur: 0.12, type: "square", vol: 0.26 },
    ],
    [
      { freq: 988, at: 0, dur: 0.1, type: "square", vol: 0.045 },
      { freq: 1245, at: 0.12, dur: 0.1, type: "square", vol: 0.045 },
      { freq: 1480, at: 0.24, dur: 0.12, type: "square", vol: 0.05 },
      { freq: 1976, at: 0.4, dur: 0.15, type: "square", vol: 0.045 },
    ],
    [
      { freq: 740, at: 0, dur: 0.11, type: "square", vol: 0.05 },
      { freq: 988, at: 0.16, dur: 0.13, type: "square", vol: 0.05 },
      { freq: 1175, at: 0.32, dur: 0.12, type: "square", vol: 0.045 },
      { freq: 1568, at: 0.5, dur: 0.18, type: "square", vol: 0.05 },
    ],
  ],
  birds: [
    [
      { freq: 2400, at: 0, dur: 0.08, type: "sine", vol: 0.04 },
      { freq: 2800, at: 0.1, dur: 0.07, type: "sine", vol: 0.035 },
      { freq: 2200, at: 0.22, dur: 0.09, type: "sine", vol: 0.04 },
      { freq: 3100, at: 0.35, dur: 0.08, type: "sine", vol: 0.035 },
      { freq: 2600, at: 0.5, dur: 0.1, type: "sine", vol: 0.04 },
      { freq: 2900, at: 0.65, dur: 0.09, type: "sine", vol: 0.035 },
    ],
    [
      { freq: 2100, at: 0, dur: 0.1, type: "sine", vol: 0.038 },
      { freq: 2650, at: 0.15, dur: 0.09, type: "sine", vol: 0.04 },
      { freq: 3200, at: 0.3, dur: 0.08, type: "sine", vol: 0.035 },
      { freq: 2450, at: 0.48, dur: 0.1, type: "sine", vol: 0.04 },
    ],
    [
      { freq: 2750, at: 0, dur: 0.07, type: "sine", vol: 0.04 },
      { freq: 2300, at: 0.12, dur: 0.09, type: "sine", vol: 0.038 },
      { freq: 3000, at: 0.28, dur: 0.08, type: "sine", vol: 0.035 },
      { freq: 2550, at: 0.45, dur: 0.1, type: "sine", vol: 0.04 },
      { freq: 2850, at: 0.62, dur: 0.09, type: "sine", vol: 0.035 },
    ],
  ],
  piano: [
    [
      { freq: 262, at: 0, dur: 0.42, type: "triangle", vol: 0.11 },
      { freq: 330, at: 0.2, dur: 0.38, type: "triangle", vol: 0.1 },
      { freq: 392, at: 0.38, dur: 0.4, type: "triangle", vol: 0.11 },
      { freq: 523, at: 0.62, dur: 0.48, type: "triangle", vol: 0.12 },
      { freq: 659, at: 0.95, dur: 0.55, type: "sine", vol: 0.1 },
    ],
    [
      { freq: 294, at: 0, dur: 0.35, type: "triangle", vol: 0.1 },
      { freq: 370, at: 0.18, dur: 0.36, type: "triangle", vol: 0.1 },
      { freq: 440, at: 0.36, dur: 0.38, type: "triangle", vol: 0.11 },
      { freq: 587, at: 0.58, dur: 0.45, type: "triangle", vol: 0.12 },
    ],
    [
      { freq: 349, at: 0, dur: 0.4, type: "triangle", vol: 0.1 },
      { freq: 440, at: 0.22, dur: 0.38, type: "triangle", vol: 0.11 },
      { freq: 523, at: 0.48, dur: 0.42, type: "triangle", vol: 0.11 },
      { freq: 698, at: 0.78, dur: 0.52, type: "sine", vol: 0.1 },
    ],
  ],
  sparkle: [
    [
      { freq: 1568, at: 0, dur: 0.2, type: "sine", vol: 0.07 },
      { freq: 2093, at: 0.12, dur: 0.22, type: "sine", vol: 0.06 },
      { freq: 2637, at: 0.28, dur: 0.18, type: "triangle", vol: 0.05 },
      { freq: 3136, at: 0.42, dur: 0.25, type: "sine", vol: 0.06 },
      { freq: 2794, at: 0.62, dur: 0.2, type: "sine", vol: 0.05 },
      { freq: 3520, at: 0.78, dur: 0.28, type: "triangle", vol: 0.05 },
    ],
    [
      { freq: 1760, at: 0, dur: 0.18, type: "sine", vol: 0.08 },
      { freq: 2217, at: 0.15, dur: 0.2, type: "sine", vol: 0.07 },
      { freq: 2794, at: 0.32, dur: 0.22, type: "triangle", vol: 0.06 },
      { freq: 3322, at: 0.52, dur: 0.25, type: "sine", vol: 0.06 },
    ],
    [
      { freq: 2093, at: 0, dur: 0.15, type: "sine", vol: 0.07 },
      { freq: 2637, at: 0.1, dur: 0.18, type: "sine", vol: 0.06 },
      { freq: 3136, at: 0.25, dur: 0.2, type: "triangle", vol: 0.06 },
      { freq: 3729, at: 0.45, dur: 0.22, type: "sine", vol: 0.05 },
      { freq: 2794, at: 0.68, dur: 0.3, type: "sine", vol: 0.06 },
    ],
  ],
  musicbox: [
    [
      { freq: 523, at: 0, dur: 0.55, type: "triangle", vol: 0.1 },
      { freq: 659, at: 0.45, dur: 0.5, type: "triangle", vol: 0.09 },
      { freq: 784, at: 0.9, dur: 0.55, type: "triangle", vol: 0.1 },
      { freq: 1047, at: 1.35, dur: 0.65, type: "triangle", vol: 0.11 },
    ],
    [
      { freq: 440, at: 0, dur: 0.5, type: "triangle", vol: 0.09 },
      { freq: 554, at: 0.4, dur: 0.48, type: "triangle", vol: 0.1 },
      { freq: 659, at: 0.82, dur: 0.52, type: "triangle", vol: 0.1 },
      { freq: 880, at: 1.2, dur: 0.6, type: "triangle", vol: 0.1 },
    ],
    [
      { freq: 392, at: 0, dur: 0.48, type: "triangle", vol: 0.09 },
      { freq: 494, at: 0.38, dur: 0.45, type: "triangle", vol: 0.1 },
      { freq: 587, at: 0.75, dur: 0.5, type: "triangle", vol: 0.1 },
      { freq: 740, at: 1.1, dur: 0.58, type: "triangle", vol: 0.11 },
    ],
  ],
};

/**
 * @param {string} soundId
 * @param {number} variant
 */
export function getMelodyVariant(soundId, variant = 0) {
  const key = soundId === "default" ? "default" : soundId;
  const variants = ALARM_MELODY_VARIANTS[key] || ALARM_MELODY_VARIANTS.default;
  return variants[variant % variants.length];
}

/**
 * Approximate length of a melody in seconds (for loop timing).
 * @param {MelodyNote[]} notes
 */
export function melodyDurationSec(notes) {
  if (!notes?.length) return 1.8;
  return Math.max(...notes.map((n) => n.at + n.dur)) + 0.35;
}
