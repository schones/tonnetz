export function createBpmSlider(container, initialBpm, onChange) {
    container.innerHTML = `
    <div class="rhythm-tempo-row">
      <label class="form-label">Tempo (BPM)</label>
      <input type="range" class="rhythm-bpm-slider" min="40" max="200" value="${initialBpm}" aria-label="Tempo slider">
      <span class="rhythm-bpm-display">${initialBpm}</span>
      <input type="number" class="form-input rhythm-bpm-input" min="40" max="200" value="${initialBpm}" aria-label="Tempo input">
    </div>
  `;

    const slider = container.querySelector('.rhythm-bpm-slider');
    const input = container.querySelector('.rhythm-bpm-input');
    const display = container.querySelector('.rhythm-bpm-display');

    function updateBpm(val) {
        let bpm = parseInt(val, 10);
        if (isNaN(bpm)) bpm = 90;
        bpm = Math.max(40, Math.min(200, bpm));

        slider.value = bpm;
        input.value = bpm;
        display.textContent = bpm;

        if (onChange) onChange(bpm);
    }

    slider.addEventListener('input', (e) => {
        input.value = e.target.value;
        display.textContent = e.target.value;
    });

    slider.addEventListener('change', (e) => updateBpm(e.target.value));
    input.addEventListener('change', (e) => updateBpm(e.target.value));

    return {
        get value() { return parseInt(slider.value, 10); },
        set value(val) { updateBpm(val); }
    };
}
