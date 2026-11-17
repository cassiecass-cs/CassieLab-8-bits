class SoundsManager {
    sounds;
    constructor() {
        this.sounds = StorageDB.getSounds();
    }
    addSound(sound) {
        this.sounds.push(sound);
        StorageDB.saveSounds(this.sounds);
    }
    getSounds() {
        return this.sounds;
    }
    update(updatedSound) {
        const index = this.sounds.findIndex(s => s.id === updatedSound.id);
        if (index !== -1) {
            this.sounds[index] = updatedSound;
            StorageDB.saveSounds(this.sounds);
        }
        else {
            console.warn("This sound doesn't exist.");
        }
    }
    delete(id) {
        this.sounds = this.sounds.filter(s => s.id !== id);
        StorageDB.saveSounds(this.sounds);
    }
}
class StorageDB {
    static STORAGE_KEY = "cassie_bit_sounds";
    static getSounds() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data)
            return [];
        try {
            return JSON.parse(data);
        }
        catch (e) {
            console.error("Error al parsear los sonidos de localStorage", e);
            return [];
        }
    }
    static saveSounds(sounds) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sounds));
    }
}
class SoundPlayer {
    audioCtx;
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    play(sound) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const now = this.audioCtx.currentTime;
        const duration = Math.max(0.05, sound.time);
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, sound.volume)), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        gainNode.connect(this.audioCtx.destination);
        if (sound.wave === 'noise') {
            const bufferSize = this.audioCtx.sampleRate * duration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noiseSource = this.audioCtx.createBufferSource();
            noiseSource.buffer = buffer;
            noiseSource.connect(gainNode);
            noiseSource.start(now);
            noiseSource.stop(now + duration);
        }
        else {
            const osc = this.audioCtx.createOscillator();
            osc.type = sound.wave;
            const startFreq = Math.max(10, sound.frequency);
            const endFreq = Math.max(10, sound.frequency + sound.slide);
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
            if (sound.vibration.depth > 0) {
                const lfo = this.audioCtx.createOscillator();
                lfo.frequency.setValueAtTime(sound.vibration.speed || 15, now);
                const lfoGain = this.audioCtx.createGain();
                lfoGain.gain.setValueAtTime(sound.vibration.depth, now);
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(now);
                lfo.stop(now + duration);
            }
            osc.connect(gainNode);
            osc.start(now);
            osc.stop(now + duration);
        }
    }
}
function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    let result;
    if (numOfChan === 2) {
        const channel0 = buffer.getChannelData(0);
        const channel1 = buffer.getChannelData(1);
        result = new Float32Array(channel0.length * 2);
        for (let i = 0; i < channel0.length; i++) {
            result[i * 2] = channel0[i];
            result[i * 2 + 1] = channel1[i];
        }
    }
    else {
        result = buffer.getChannelData(0);
    }
    const dataLength = result.length * (bitDepth / 8);
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    let pos = 0;
    function writeString(str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(pos++, str.charCodeAt(i));
        }
    }
    writeString('RIFF');
    view.setUint32(pos, 36 + dataLength, true);
    pos += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(pos, 16, true);
    pos += 4;
    view.setUint16(pos, format, true);
    pos += 2;
    view.setUint16(pos, numOfChan, true);
    pos += 2;
    view.setUint32(pos, sampleRate, true);
    pos += 4;
    view.setUint32(pos, sampleRate * numOfChan * (bitDepth / 8), true);
    pos += 4;
    view.setUint16(pos, numOfChan * (bitDepth / 8), true);
    pos += 2;
    view.setUint16(pos, bitDepth, true);
    pos += 2;
    writeString('data');
    view.setUint32(pos, dataLength, true);
    pos += 4;
    for (let i = 0; i < result.length; i++, pos += 2) {
        let sample = Math.max(-1, Math.min(1, result[i]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767);
        view.setInt16(pos, sample, true);
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}
export class Toast {
    title;
    message;
    type;
    sounds;
    constructor(title, message, type) {
        this.title = title;
        this.message = message;
        this.type = type;
        this.sounds = {
            success: new Audio("./musica/notificacion.wav"),
            error: new Audio("./musica/notificacion.wav"),
            alert: new Audio("./musica/notificacion.wav")
        };
    }
    modify(title, message, type) {
        this.title = title;
        this.message = message;
        this.type = type;
    }
    show() {
        const currentSound = this.sounds[this.type];
        if (currentSound) {
            currentSound.currentTime = 0;
            currentSound.play().catch(error => {
                console.log("Error al reproducir audio:", error);
            });
        }
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${this.type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <h4 class="toast-title">${this.title}</h4>
                <p class="toast-message">${this.message}</p>
            </div>
            <button class="toast-close" aria-label="Cerrar">&times;</button>
        `;
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => {
            toast.remove();
        });
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.isConnected) {
                toast.remove();
            }
        }, 4000);
    }
}
class View {
    coin;
    jump;
    laser;
    nameInput;
    waveSelect;
    frequencyInput;
    slideInput;
    timeInput;
    volumeInput;
    vibrationInput;
    playButton;
    saveButton;
    downloadButton;
    searchInput;
    soundsList;
    soundsManager;
    soundPlayer;
    toast;
    constructor(soundsManager) {
        this.coin = document.getElementById('coin');
        this.jump = document.getElementById('jump');
        this.laser = document.getElementById('laser');
        this.nameInput = document.getElementById('name');
        this.waveSelect = document.getElementById('wave');
        this.frequencyInput = document.getElementById('frequency');
        this.slideInput = document.getElementById('slide');
        this.timeInput = document.getElementById('time');
        this.volumeInput = document.getElementById('volume');
        this.vibrationInput = document.getElementById('vibration');
        this.playButton = document.getElementById('play');
        this.saveButton = document.getElementById('save');
        this.downloadButton = document.getElementById('download');
        this.searchInput = document.getElementById('search');
        this.soundsList = document.getElementById('sounds-list');
        this.soundsManager = soundsManager;
        this.soundPlayer = new SoundPlayer();
        this.toast = new Toast("", "", "success");
        this.initEvents();
        this.loadSounds();
    }
    initEvents() {
        this.playButton.addEventListener("click", () => {
            const name = this.nameInput.value;
            if (name !== "") {
                const currentSound = {
                    id: Date.now(),
                    name: name,
                    wave: this.waveSelect.value.toLowerCase(),
                    frequency: Number(this.frequencyInput.value),
                    slide: Number(this.slideInput.value),
                    time: Number(this.timeInput.value),
                    volume: Number(this.volumeInput.value),
                    vibration: {
                        depth: Number(this.vibrationInput.value),
                        speed: 15
                    }
                };
                this.soundPlayer.play(currentSound);
            }
            else {
                // CORREGIDO AQUÍ: Usamos modify y show
                this.toast.modify("Aviso", "No puedes dejar los campos vacíos", "error");
                this.toast.show();
            }
        });
        this.coin.addEventListener("click", () => {
            const coinPreset = {
                id: Date.now(),
                name: "Coin 8-bit",
                wave: "square",
                frequency: 980,
                slide: 350,
                time: 0.25,
                volume: 0.5,
                vibration: { depth: 0, speed: 15 }
            };
            this.loadSoundPreset(coinPreset);
            this.soundPlayer.play(coinPreset);
        });
        this.jump.addEventListener("click", () => {
            const jumpPreset = {
                id: Date.now(),
                name: "Jump 8-bit",
                wave: "square",
                frequency: 350,
                slide: 400,
                time: 0.2,
                volume: 0.5,
                vibration: { depth: 0, speed: 15 }
            };
            this.loadSoundPreset(jumpPreset);
            this.soundPlayer.play(jumpPreset);
        });
        this.laser.addEventListener("click", () => {
            const laserPreset = {
                id: Date.now(),
                name: "Laser 8-bit",
                wave: "sawtooth",
                frequency: 1200,
                slide: -900,
                time: 0.25,
                volume: 0.5,
                vibration: { depth: 5, speed: 20 }
            };
            this.loadSoundPreset(laserPreset);
            this.soundPlayer.play(laserPreset);
        });
        this.saveButton.addEventListener("click", () => {
            const name = this.nameInput.value.trim();
            if (name !== "") {
                const soundToSave = {
                    id: Date.now(),
                    name: name,
                    wave: this.waveSelect.value.toLowerCase(),
                    frequency: Number(this.frequencyInput.value),
                    slide: Number(this.slideInput.value),
                    time: Number(this.timeInput.value),
                    volume: Number(this.volumeInput.value),
                    vibration: {
                        depth: Number(this.vibrationInput.value),
                        speed: 15
                    }
                };
                this.soundsManager.addSound(soundToSave);
                this.loadSounds();
                // CORREGIDO AQUÍ
                this.toast.modify("Aviso", "Sonido guardado correctamente", "success");
                this.toast.show();
            }
            else {
                // CORREGIDO AQUÍ
                this.toast.modify("Aviso", "No puedes dejar los campos vacíos", "error");
                this.toast.show();
            }
        });
        this.downloadButton.addEventListener("click", async () => {
            const name = this.nameInput.value.trim();
            const soundName = name !== "" ? name : "retro-sound";
            const currentSound = {
                id: Date.now(),
                name: soundName,
                wave: this.waveSelect.value.toLowerCase(),
                frequency: Number(this.frequencyInput.value),
                slide: Number(this.slideInput.value),
                time: Number(this.timeInput.value),
                volume: Number(this.volumeInput.value),
                vibration: {
                    depth: Number(this.vibrationInput.value),
                    speed: 15
                }
            };
            const duration = Math.max(0.05, currentSound.time);
            const sampleRate = 44100;
            const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
            const now = 0;
            const gainNode = offlineCtx.createGain();
            gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, currentSound.volume)), now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            gainNode.connect(offlineCtx.destination);
            if (currentSound.wave === 'noise') {
                const bufferSize = sampleRate * duration;
                const buffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noiseSource = offlineCtx.createBufferSource();
                noiseSource.buffer = buffer;
                noiseSource.connect(gainNode);
                noiseSource.start(now);
            }
            else {
                const osc = offlineCtx.createOscillator();
                osc.type = currentSound.wave;
                const startFreq = Math.max(10, currentSound.frequency);
                const endFreq = Math.max(10, currentSound.frequency + currentSound.slide);
                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
                if (currentSound.vibration.depth > 0) {
                    const lfo = offlineCtx.createOscillator();
                    lfo.frequency.setValueAtTime(15, now);
                    const lfoGain = offlineCtx.createGain();
                    lfoGain.gain.setValueAtTime(currentSound.vibration.depth, now);
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);
                    lfo.start(now);
                }
                osc.connect(gainNode);
                osc.start(now);
            }
            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWavBlob(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${soundName.toLowerCase().replace(/\s+/g, '-')}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            // CORREGIDO AQUÍ
            this.toast.modify("Aviso", "Sonido descargado correctamente", "success");
            this.toast.show();
        });
        this.searchInput.addEventListener("input", () => {
            const query = this.searchInput.value.toLowerCase().trim();
            this.loadSounds(query);
        });
    }
    loadSoundPreset(sound) {
        this.nameInput.value = sound.name;
        const targetWave = sound.wave.toLowerCase();
        for (let i = 0; i < this.waveSelect.options.length; i++) {
            const option = this.waveSelect.options[i];
            if (option.value.toLowerCase() === targetWave || option.text.toLowerCase() === targetWave) {
                this.waveSelect.value = option.value;
                break;
            }
        }
        this.frequencyInput.value = sound.frequency.toString();
        this.slideInput.value = sound.slide.toString();
        this.timeInput.value = sound.time.toString();
        this.volumeInput.value = sound.volume.toString();
        this.vibrationInput.value = sound.vibration.depth.toString();
    }
    loadSounds(filterText = "") {
        if (!this.soundsList)
            return;
        this.soundsList.innerHTML = "";
        const sounds = this.soundsManager.getSounds();
        const filteredSounds = sounds.filter(sound => sound.name.toLowerCase().includes(filterText) ||
            sound.wave.toLowerCase().includes(filterText));
        if (filteredSounds.length === 0) {
            this.soundsList.innerHTML = "<p>No sounds found.</p>";
            return;
        }
        filteredSounds.forEach((sound) => {
            const item = document.createElement("div");
            item.className = "sound-item";
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";
            item.style.marginBottom = "8px";
            item.style.cursor = "pointer";
            const title = document.createElement("span");
            title.textContent = `${sound.name} (${sound.wave})`;
            item.addEventListener("click", () => {
                this.loadSoundPreset(sound);
                this.soundPlayer.play(sound);
            });
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "button-alert";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.soundsManager.delete(sound.id);
                this.loadSounds(this.searchInput.value.toLowerCase().trim());
            });
            item.appendChild(title);
            item.appendChild(deleteBtn);
            this.soundsList.appendChild(item);
        });
    }
}
class CassieLab {
    soundsManager;
    view;
    constructor(soundsManager) {
        this.soundsManager = soundsManager;
        this.view = new View(this.soundsManager);
    }
}
const soundsManager = new SoundsManager();
new CassieLab(soundsManager);
