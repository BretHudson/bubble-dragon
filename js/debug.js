let inspector;
let settings;

const titleOverrides = {
	seed: 'Use Seed',
};

const callbacks = {
	seed: (v) => (v ? 78493 : undefined),
};

const types = {
	autoLevel: 'checkbox',
	showCamera: 'checkbox',
	showHitboxes: 'checkbox',
	invincible: 'checkbox',
	hideOverlay: 'checkbox',
	seed: 'checkbox',
	playerSpeed: 'number',
	cameraInner: 'number',
	cameraOuter: 'number',
	cameraSpeed: 'number',
	enemyHealth: 'number',
};

const values = {
	playerSpeed: { min: 1, max: 10, step: 1 },
	cameraInner: { min: 0, max: 500, step: 1 },
	cameraOuter: { min: 0, max: 500, step: 1 },
	cameraSpeed: { min: 0, max: 100, step: 0.1 },
	enemyHealth: { min: 1, max: 100, step: 1 },
};

const saveSettings = () => {
	const json = JSON.stringify(settings);
	localStorage.setItem('settings', json);
	console.log('saved', json);
};

const camelToWords = (name) => {
	const str = name.replaceAll(/([a-z])([A-Z])/g, (...args) => {
		const [_, lower, upper] = args;
		return lower + ' ' + upper;
	});
	return str.charAt(0).toUpperCase() + str.slice(1);
};

const _createInput = (type, name, defaultValue, callback) => {
	const wrapper = document.createElement('div');
	wrapper.classList.add('input');

	const label = document.createElement('label');
	const labelText = titleOverrides[name] ?? camelToWords(name);
	label.textContent = labelText;
	const input = document.createElement('input');
	input.type = type;
	input.name = name;

	const _callback = (...args) => {
		callback(...args);
		saveSettings();
	};

	switch (type) {
		case 'checkbox':
			input.addEventListener('change', (e) => {
				_callback(e.target.checked);
			});
			input.checked = defaultValue;
			break;
		case 'number':
			input.addEventListener('change', (e) => {
				_callback(e.target.value);
			});
			input.value = defaultValue;
			break;
		default:
			throw new Error(`"${type}" is not a valid input type`);
	}

	wrapper.append(label, input);
	inspector.append(wrapper);

	return input;
};

const createCheckbox = (name) => {
	const defaultValue = Boolean(settings[name]);
	const callback = (v) => {
		settings[name] = callbacks[name]?.(+v) ?? +v;
	};
	_createInput.bind(0, 'checkbox')(name, defaultValue, callback);
};

const createNumber = (name) => {
	const defaultValue = settings[name];
	const callback = (v) => {
		settings[name] = callbacks[name]?.(v) ?? v;
	};
	const input = _createInput.bind(0, 'number')(name, defaultValue, callback);
	const { min, max, step } = values[name];
	input.min = min;
	input.max = max;
	input.step = step;
};

const createInput = (name) => {
	const type = types[name];
	switch (type) {
		case 'checkbox':
			createCheckbox(name);
			break;
		case 'number':
			createNumber(name);
			break;
		default: {
			throw new Error(`createInput() | "${type}" (${name}) is invalid`);
		}
	}
};

export const initDebug = (game, _settings, defaultSettings) => {
	const { canvas } = game;

	settings = _settings;

	inspector = document.createElement('div');
	inspector.classList.add('inspector');
	canvas.after(inspector);

	Object.keys(_settings).forEach(createInput);

	const reset = () => {
		Object.entries(defaultSettings).forEach(([k, v]) => {
			const input = document.querySelector(`[name=${k}]`);
			switch (input.type) {
				case 'checkbox':
					input.checked = Boolean(v);
					break;
				case 'number':
					input.value = v;
					break;
				default:
					input.value = v;
					break;
			}
			settings[k] = v;
		});
		saveSettings();
	};
	const resetButton = document.createElement('button');
	resetButton.textContent = 'Reset';
	resetButton.addEventListener('click', () => {
		reset();
	});
	inspector.append(resetButton);
};
