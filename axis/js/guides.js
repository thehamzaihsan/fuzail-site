// Step-by-step guides shown when a procedure is selected. Each step: title, what to do, what to watch for.
export const GUIDES = {
  stent: {
    title: 'Coronary angiogram and stent (PCI) of the LAD',
    steps: [
      { icon: '🫀', title: 'The patient', do: [
        'One of the coronary arteries (the LAD) is narrowed by a plaque. The heart muscle beyond it is starving: the infarct clock is running (top-left, "LAD flow · infarct").',
        'You work through the radial artery at the wrist, up the aorta to the opening of the left coronary artery. Everything moves only when you push or pull it with the precision dial on the left.',
        'The panel shows one step at a time, with only the buttons for that step.'],
        watch: 'Push slowly. Fast pushes tear the artery wall; anything driven out of the end of the artery perforates it.' },
      { icon: '🧵', title: '1-3 · Guide wire, catheter, wire out', do: [
        'Push the guide wire up the aorta until its tip reaches the coronary opening.',
        'Advance the catheter (a thin flexible tube) over the wire to the opening. It can only follow the wire.',
        'Pull the guide wire out completely. The catheter stays.'] },
      { icon: '🎯', title: '4 · Engage the catheter tip', do: [
        'Push just the tip of the catheter 2-5 mm into the coronary artery, then press "Confirm engagement".'],
        watch: 'Deeper than ~8 mm the catheter blocks the artery; deeper than ~12 mm it tears it.' },
      { icon: '🩻', title: '5 · X-ray angiogram', do: [
        'The view switches to black-and-white X-ray. Hold "Inject dye": the dark dye fills the artery.',
        'Where the plaque narrows the artery, the dye column narrows. Once found, press "Plaque found".',
        'You can switch between X-ray and normal view and inject dye again at any later step.'] },
      { icon: '➰', title: '6 · Wire across the blockage', do: [
        'Push the coronary wire through the catheter down the artery and past the plaque.',
        'At the diagonal branch (30%), keep the tip rotated away from it or the wire goes down the branch.'],
        watch: 'Over ~14 mm/s tears the wall; over ~4 mm/s through the plaque breaks it up (no-reflow). Pushing at the end of the artery perforates it.' },
      { icon: '🎈', title: '7-9 · Balloon', do: [
        'Load the balloon and push it along the wire until it sits between the two green rings.',
        'Hold "Inflate" to 8-12 atm: the plaque is pushed open and the balloon measures the artery. The measurements appear in the panel on the right.',
        'Deflate, then pull the balloon out.'],
        watch: 'Inflating off the plaque tears healthy artery. Above 16 atm the balloon bursts. The artery is blocked while the balloon is inflated.' },
      { icon: '📏', title: '10 · Choose the stent', do: [
        'Pick the stent with the same diameter as the measured artery and a length a few millimetres longer than the plaque.'],
        watch: 'Too narrow: it does not touch the wall. Too wide: it tears the edges (and ruptures easily). Too short: the plaque edges stay narrowed.' },
      { icon: '🧷', title: '11-12 · Place and open the stent', do: [
        'The stent comes crimped on a new balloon. Push it to the centre of the plaque.',
        'Hold "Inflate" to 12-14 atm, then press Deflate: the stent stays open against the wall. Pull the empty balloon out.'],
        watch: 'Deflating below 10 atm leaves the stent on the balloon; inflate again.' },
      { icon: '✅', title: '13-14 · Finish', do: [
        'Pull the catheter out, then the wire. A dye injection before you remove the catheter shows the opened artery.'] },
    ],
  },
  puncture: {
    title: 'Chest needle: puncture, decompression and drain',
    steps: [
      { icon: '🫁', title: 'Two ways to practise', do: [
        'Free practice: a healthy patient. Whatever you puncture is real.',
        'Emergency: a stab wound has caused a LEFT tension pneumothorax. Air is trapped around the lung and building pressure. You must decompress it within about 2 minutes.'],
        watch: 'Monitor top-left: SpO₂ and BP fall, HR and RR rise as the lung collapses. "Pleural air / blood" shows how much is trapped.' },
      { icon: '🎯', title: '1. Landmark: tap, then confirm', do: [
        'The procedure runs one step at a time: the panel only offers the controls for the current step.',
        'Rotate the view first: the needle goes in along your line of sight. Tap the chest to place the green mark; tap again to move it; press "Confirm site".',
        'Emergency sites: 2nd intercostal space, mid-clavicular line (just above the 3rd rib), or the 4th/5th space, anterior axillary line.'],
        watch: 'Too close to the sternum on the left: heart. Too low: diaphragm and liver.' },
      { icon: '🧴', title: '2. Prepare', do: [
        'Press "Clean the skin", then "Local anaesthetic". In the emergency you may skip the anaesthetic to save time.',
        'The needle is then placed on the skin and the camera swings to the side.'] },
      { icon: '🎚️', title: '3. Advance with the precision dial', do: [
        'Drag the dial up to advance, down to withdraw. Slow, steady strokes keep the needle still.',
        'Fast or jerky strokes make the needle shake (up to ~1.6 mm); the readout shows "hand steady / a little shaky / SHAKING". It settles within about half a second once you slow down.',
        'If you hit bone, pull back a little and walk over the TOP of the rib.'],
        watch: 'The intercostal vessels run UNDER each rib. Pushing fast through the pleura makes the needle jump in. A shaking tip in the lung saws the hole wider.' },
      { icon: '💨', title: '4. Hold steady in the pleural space', do: [
        'At the pop into the pleural space the step changes to "Hold steady". Keep the dial still.',
        'Emergency: air hisses out until the tension is released. Free practice: hold for 4 s to aspirate.'],
        watch: 'Pushing on into LUNG TISSUE or slipping back out sends you back to step 3.' },
      { icon: '🩺', title: '5. Withdraw, then drain or cover', do: [
        'Press "Withdraw the needle": it comes out smoothly along the same line.',
        'If air is still building up (always in the emergency), press "Insert chest drain" and tap the safe triangle: lateral chest wall, 4th-5th space, between the anterior and mid-axillary lines. Otherwise cover the site.'],
        watch: 'A drain placed too low goes through the diaphragm into the liver.' },
      { icon: '🧵', title: '6. Drain care, then close', do: [
        'The drain button cycles water seal → suction −20 cmH₂O → CLAMPED.',
        '"Remove drain" turns green once the lung is up and the bubbling has stopped.',
        'Then "Suture the wound", then "Apply dressing". The procedure completes when the patient is stable.'],
        watch: 'Never clamp a bubbling drain. Removing it early lets the pneumothorax come back.' },
      { icon: '🚨', title: 'Rescue tools and outcome', do: [
        '"Pericardiocentesis" if blood collects around the heart.',
        '"Transfuse 500 mL" (up to 6 units) if blood loss is rising.',
        '"Call surgeon" stops bleeding injuries after 45 s.',
        'The procedure is complete when the patient is stable (no active leaks, normal pressure) and the wound is closed and dressed.'],
        watch: 'Cardiac arrest lasting 20 s means death. The debrief shows the timeline of every mistake.' },
    ],
  },
};
