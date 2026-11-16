// Anatomical flow paths for AXIS, in Blender world coordinates (metres, Z up) taken from
// Human_Anotumy_AXIS.blend: vessel centrelines were sliced out of the Arteries/Veins meshes,
// heart landmarks read from orthographic renders of the heart, airway from the Lungs mesh.
// toThree() converts to the glTF / three.js frame (Y up): (x, y, z) -> (x, z, -y).

export const toThree = ([x, y, z]) => [x, z, -y];

// ---------------- Systemic veins -> right heart ----------------
const RA = [-0.012, -0.045, 1.315];
const SVC_TOP = [-0.006, -0.050, 1.372];
export const VEINS = {
  ivc: { kind: 'vein', pts: [[0.000, -0.052, 0.950], [-0.012, -0.057, 1.060], [-0.011, -0.053, 1.139], [-0.006, -0.041, 1.189], [0.006, -0.018, 1.234], [0.016, -0.016, 1.276], [0.008, -0.016, 1.284], [0.000, -0.030, 1.298], RA] },
  rJugular: { kind: 'vein', pts: [[-0.054, -0.071, 1.550], [-0.053, -0.065, 1.486], [-0.042, -0.047, 1.395], [-0.020, -0.050, 1.385], SVC_TOP, [-0.009, -0.043, 1.340], RA] },
  lJugular: { kind: 'vein', pts: [[0.037, -0.055, 1.545], [0.035, -0.054, 1.516], [0.032, -0.050, 1.390], [0.008, -0.045, 1.396], SVC_TOP, [-0.009, -0.043, 1.340], RA] },
  rArmV: { kind: 'vein', pts: [[-0.110, -0.034, 1.402], [-0.075, -0.032, 1.402], [-0.042, -0.047, 1.395], [-0.020, -0.050, 1.385], SVC_TOP, [-0.009, -0.043, 1.340], RA] },
  lArmV: { kind: 'vein', pts: [[0.110, -0.020, 1.398], [0.065, -0.023, 1.396], [0.032, -0.050, 1.390], [0.008, -0.045, 1.396], SVC_TOP, [-0.009, -0.043, 1.340], RA] },
};

// ---------------- Right heart -> pulmonary arteries ----------------
const PA_BIF = [0.020, -0.048, 1.342];
export const RIGHT_HEART = {
  kind: 'av', // tricuspid inflow happens in diastole, outflow in systole (handled per point index)
  inflow: [RA, [0.000, -0.058, 1.298], [0.010, -0.072, 1.284], [0.018, -0.078, 1.272]],
  outflow: [[0.018, -0.078, 1.272], [0.022, -0.078, 1.300], [0.022, -0.072, 1.318], [0.024, -0.062, 1.334], PA_BIF],
};
const HILUM_R = [-0.049, -0.019, 1.316], HILUM_L = [0.030, -0.020, 1.322];
export const PULM_ART = {
  R: [PA_BIF, [0.005, -0.035, 1.340], [-0.020, -0.028, 1.330], HILUM_R],
  L: [PA_BIF, [0.032, -0.045, 1.335], [0.034, -0.030, 1.326], HILUM_L],
};
// lobes (interior points: lobe centroid pulled 30% toward the lung centroid)
export const LOBES = {
  R: [[-0.064, -0.024, 1.349], [-0.069, -0.040, 1.305], [-0.085, -0.025, 1.261]],
  L: [[0.053, -0.033, 1.341], [0.059, -0.048, 1.300], [0.072, -0.035, 1.259]],
};
export const HILUM = { R: HILUM_R, L: HILUM_L };
// pulmonary veins back to the left atrium
const LA = [0.016, -0.022, 1.315];
export const PULM_VEIN = {
  R: [[-0.045, -0.014, 1.312], [-0.020, -0.012, 1.316], [0.006, -0.012, 1.318], LA],
  L: [[0.034, -0.016, 1.316], [0.026, -0.016, 1.316], LA],
};
// ---------------- Left heart -> aorta ----------------
export const LEFT_HEART = {
  inflow: [LA, [0.022, -0.036, 1.298], [0.030, -0.050, 1.278], [0.036, -0.064, 1.258]],
  outflow: [[0.036, -0.064, 1.258], [0.020, -0.052, 1.300], [0.010, -0.050, 1.312], [0.006, -0.050, 1.336], [0.006, -0.046, 1.356], [0.010, -0.034, 1.366]],
};
const ARCH = [0.010, -0.034, 1.366];
export const ARTERIES = {
  descending: { w: 0.62, end: 'ivc', pts: [ARCH, [0.016, -0.020, 1.356], [0.018, -0.012, 1.330], [0.018, -0.018, 1.236], [0.002, -0.048, 1.188], [-0.009, -0.060, 1.120], [-0.006, -0.051, 1.030], [0.000, -0.055, 0.960]] },
  rCarotid: { w: 0.11, end: 'rJugular', pts: [ARCH, [0.004, -0.042, 1.368], [-0.010, -0.045, 1.385], [-0.029, -0.045, 1.403], [-0.037, -0.041, 1.429], [-0.039, -0.047, 1.458], [-0.048, -0.053, 1.492], [-0.055, -0.056, 1.523]] },
  rSubclavian: { w: 0.07, end: 'rArmV', pts: [ARCH, [0.004, -0.042, 1.368], [-0.010, -0.045, 1.385], [-0.029, -0.045, 1.403], [-0.069, -0.043, 1.398], [-0.110, -0.040, 1.400]] },
  lCarotid: { w: 0.11, end: 'lJugular', pts: [ARCH, [0.010, -0.038, 1.372], [0.011, -0.046, 1.401], [0.010, -0.043, 1.437], [0.017, -0.051, 1.471], [0.032, -0.054, 1.522]] },
  lSubclavian: { w: 0.09, end: 'lArmV', pts: [ARCH, [0.014, -0.030, 1.368], [0.051, -0.032, 1.406], [0.073, -0.017, 1.379], [0.110, -0.020, 1.380]] },
};

// ---------------- Airway ----------------
const CARINA = [-0.009, -0.028, 1.355];
export const AIRWAY = {
  trachea: [[-0.016, -0.072, 1.462], [-0.0137, -0.051, 1.440], [-0.0125, -0.042, 1.420], [-0.013, -0.030, 1.395], CARINA],
  R: [CARINA, [-0.030, -0.026, 1.338], HILUM_R],
  L: [CARINA, [0.008, -0.024, 1.340], [0.022, -0.018, 1.326], HILUM_L],
};

// heart landmarks used for the beating squeeze
export const HEART_CENTER = [0.0123, -0.0428, 1.3144];
